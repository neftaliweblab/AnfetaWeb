import { ANFETA_BASES, NOTION_BASE_DATABASE_IDS } from '@/lib/notionBaseCatalog';
import { notionRequest } from './notionMutations';
import type { CalendarSettings } from './notionCalendar';
import {
  getPublicBaseUrl,
  canonicalActivityUrl,
  findActivityLinkProperty,
  evaluateActivityLink,
  resolvePublicBaseUrlFromRequest,
  type ActivityLinkEvaluation,
} from '@/lib/activityCanonicalLink';

export {
  getPublicBaseUrl,
  canonicalActivityUrl,
  findActivityLinkProperty,
  evaluateActivityLink,
  resolvePublicBaseUrlFromRequest,
  type ActivityLinkEvaluation,
};

export interface BaseLinkVerificationResult {
  baseName: string;
  sourceId: string;
  databaseId: string;
  status: 'ok' | 'missing' | 'type_mismatch' | 'unauthorized' | 'error';
  propertyName?: string;
  propertyType?: string;
  message: string;
}

export interface BackfillProgressReport {
  processed: number;
  filled: number;
  repaired: number;
  alreadyCorrect: number;
  foreignCount: number;
  missingPropertyCount: number;
  foreignUrls: { pageId: string; title: string; url: string; property: string }[];
  updatedPages: { pageId: string; title: string; previousUrl?: string; newUrl: string; action: 'filled' | 'repaired' }[];
  nextCursor?: string;
  hasMore: boolean;
  dryRun: boolean;
  errors: { pageId: string; error: string }[];
}

/**
 * Verifies all enabled ANFETA bases to ensure "Abrir en ANFETA" exists and is of type URL.
 */
export async function verifyEnabledBasesLinkProperty(settings: CalendarSettings): Promise<BaseLinkVerificationResult[]> {
  const results: BaseLinkVerificationResult[] = [];

  for (const [name, sourceId] of ANFETA_BASES) {
    const databaseId = NOTION_BASE_DATABASE_IDS[sourceId] || sourceId;

    try {
      let schema: any = null;
      // Try data_sources/:id first (Notion 2026 API)
      try {
        schema = await notionRequest(
          { ...settings, notionApiVersion: '2026-03-11' },
          `data_sources/${sourceId}`
        );
      } catch {
        // Fallback to databases/:id (Notion 2022 API)
        schema = await notionRequest(settings, `databases/${databaseId}`);
      }

      if (!schema || !schema.properties) {
        results.push({
          baseName: name,
          sourceId,
          databaseId,
          status: 'error',
          message: 'No se pudo leer el esquema de la base en Notion.',
        });
        continue;
      }

      const match = findActivityLinkProperty(schema.properties);
      if (match) {
        if (match.isValid) {
          results.push({
            baseName: name,
            sourceId,
            databaseId,
            status: 'ok',
            propertyName: match.name,
            propertyType: match.type,
            message: `Propiedad "${match.name}" (tipo URL) verificada correctamente.`,
          });
        } else {
          results.push({
            baseName: name,
            sourceId,
            databaseId,
            status: 'type_mismatch',
            propertyName: match.name,
            propertyType: match.type,
            message: match.error || `La propiedad "${match.name}" no es de tipo URL.`,
          });
        }
      } else {
        results.push({
          baseName: name,
          sourceId,
          databaseId,
          status: 'missing',
          message: `Falta la propiedad "Abrir en ANFETA" (tipo URL) en la base "${name}".`,
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Error al consultar la base.';
      const isAuth = /unauthorized|token|401/i.test(msg);
      results.push({
        baseName: name,
        sourceId,
        databaseId,
        status: isAuth ? 'unauthorized' : 'error',
        message: msg,
      });
    }
  }

  return results;
}

/**
 * Saves or updates exclusively the "Abrir en ANFETA" URL property of a page in Notion.
 * Does NOT touch title, date, assignee, status, checklist or any other property.
 */
export async function saveActivityLinkToNotion(
  settings: CalendarSettings,
  pageId: string,
  options?: {
    force?: boolean;
    targetPropName?: string;
    baseUrl?: string;
    existingProperties?: Record<string, any>;
  }
): Promise<{
  success: boolean;
  status: 'updated' | 'already_up_to_date' | 'foreign_preserved' | 'missing_property' | 'type_mismatch' | 'error';
  property?: string;
  url?: string;
  existingUrl?: string;
  error?: string;
}> {
  const cleanId = String(pageId || '').replace(/-/g, '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(cleanId)) {
    return { success: false, status: 'error', error: 'ID de página no válido.' };
  }

  const token = settings.notionToken?.trim();
  if (!token) {
    return { success: false, status: 'error', error: 'Token de Notion no configurado.' };
  }

  try {
    let props = options?.existingProperties;

    // If properties not supplied, fetch page from Notion
    if (!props) {
      const page = await notionRequest(settings, `pages/${cleanId}`);
      if (page.archived || page.in_trash) {
        return { success: false, status: 'error', error: 'La página está archivada o en la papelera.' };
      }
      props = page.properties || {};
    }
    const targetProps: Record<string, any> = props || {};

    const propMatch = options?.targetPropName
      ? { name: options.targetPropName, type: 'url', isValid: true }
      : findActivityLinkProperty(targetProps);

    if (!propMatch) {
      return {
        success: false,
        status: 'missing_property',
        error: 'La fuente de Notion no tiene una propiedad "Abrir en ANFETA" de tipo URL.',
      };
    }

    if (!propMatch.isValid) {
      return {
        success: false,
        status: 'type_mismatch',
        property: propMatch.name,
        error: propMatch.error || `La propiedad "${propMatch.name}" no es de tipo URL.`,
      };
    }

    const currentUrl = targetProps[propMatch.name]?.url;
    const evaluation = evaluateActivityLink(cleanId, currentUrl, { baseUrl: options?.baseUrl });

    if (evaluation.status === 'exact' && !options?.force) {
      return {
        success: true,
        status: 'already_up_to_date',
        property: propMatch.name,
        url: evaluation.canonicalUrl,
      };
    }

    if (evaluation.status === 'foreign' && !options?.force) {
      return {
        success: false,
        status: 'foreign_preserved',
        property: propMatch.name,
        existingUrl: currentUrl,
        error: 'Se detectó una URL externa ajena a ANFETA; se conserva sin sobrescribir.',
      };
    }

    const canonical = evaluation.canonicalUrl;

    // Patch strictly the URL property
    await notionRequest(
      settings,
      `pages/${cleanId}`,
      'PATCH',
      {
        properties: {
          [propMatch.name]: { url: canonical },
        },
      }
    );

    if (targetProps && targetProps[propMatch.name]) {
      targetProps[propMatch.name].url = canonical;
    }

    return {
      success: true,
      status: 'updated',
      property: propMatch.name,
      url: canonical,
      existingUrl: currentUrl || undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Error al guardar el enlace en Notion.',
    };
  }
}

/**
 * Paged, bounded, and resumable batch processor for backfilling activity links in Notion.
 */
export async function backfillActivityLinks(
  settings: CalendarSettings,
  options: {
    cursor?: string;
    limit?: number;
    dryRun?: boolean;
    filterDatabaseId?: string;
    baseUrl?: string;
  } = {}
): Promise<BackfillProgressReport> {
  const limit = Math.min(100, Math.max(1, options.limit || 25));
  const dryRun = options.dryRun !== false; // Default to dry-run (preview mode) for safety
  const report: BackfillProgressReport = {
    processed: 0,
    filled: 0,
    repaired: 0,
    alreadyCorrect: 0,
    foreignCount: 0,
    missingPropertyCount: 0,
    foreignUrls: [],
    updatedPages: [],
    hasMore: false,
    dryRun,
    errors: [],
  };

  // Search Notion pages with sorting by last_edited_time
  let response: any;
  if (options.filterDatabaseId) {
    const dbId = options.filterDatabaseId.replace(/-/g, '');
    response = await notionRequest(settings, `databases/${dbId}/query`, 'POST', {
      page_size: limit,
      ...(options.cursor ? { start_cursor: options.cursor } : {}),
    });
  } else {
    const searchPayload: any = {
      page_size: limit,
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      ...(options.cursor ? { start_cursor: options.cursor } : {}),
    };
    response = await notionRequest(settings, 'search', 'POST', searchPayload);
  }
  const pages: any[] = (response.results || []).filter(
    (p: any) => !p.archived && !p.in_trash
  );

  report.hasMore = Boolean(response.has_more && response.next_cursor);
  report.nextCursor = response.next_cursor || undefined;

  for (const page of pages) {
    report.processed++;
    const pageId = page.id;
    const cleanId = String(pageId).replace(/-/g, '').toLowerCase();
    const props = page.properties || {};

    // Get page title for readable logging
    let pageTitle = 'Sin título';
    const titleEntry = Object.values(props).find((p: any) => p?.type === 'title') as any;
    if (titleEntry?.title && Array.isArray(titleEntry.title) && titleEntry.title.length) {
      pageTitle = titleEntry.title.map((t: any) => t.plain_text || t.text?.content || '').join('').trim() || 'Sin título';
    }

    const propMatch = findActivityLinkProperty(props);
    if (!propMatch || !propMatch.isValid) {
      report.missingPropertyCount++;
      continue;
    }

    const currentUrl = props[propMatch.name]?.url;
    const evaluation = evaluateActivityLink(cleanId, currentUrl, { baseUrl: options.baseUrl });

    if (evaluation.status === 'exact') {
      report.alreadyCorrect++;
      continue;
    }

    if (evaluation.status === 'foreign') {
      report.foreignCount++;
      report.foreignUrls.push({
        pageId: cleanId,
        title: pageTitle,
        url: currentUrl,
        property: propMatch.name,
      });
      continue;
    }

    const action = evaluation.status === 'empty' ? 'filled' : 'repaired';

    if (dryRun) {
      if (action === 'filled') report.filled++;
      if (action === 'repaired') report.repaired++;
      report.updatedPages.push({
        pageId: cleanId,
        title: pageTitle,
        previousUrl: currentUrl || undefined,
        newUrl: evaluation.canonicalUrl,
        action,
      });
    } else {
      // Execute actual Notion update
      try {
        const updateResult = await saveActivityLinkToNotion(settings, cleanId, {
          targetPropName: propMatch.name,
          baseUrl: options.baseUrl,
          existingProperties: props,
        });

        if (updateResult.success) {
          if (action === 'filled') report.filled++;
          if (action === 'repaired') report.repaired++;
          report.updatedPages.push({
            pageId: cleanId,
            title: pageTitle,
            previousUrl: currentUrl || undefined,
            newUrl: evaluation.canonicalUrl,
            action,
          });
        } else {
          report.errors.push({
            pageId: cleanId,
            error: updateResult.error || 'Error al actualizar enlace.',
          });
        }
      } catch (err: any) {
        report.errors.push({
          pageId: cleanId,
          error: err?.message || 'Error de red o permisos al guardar enlace.',
        });
      }
    }
  }

  return report;
}
