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
  propertyId?: string;
  propertyType?: string;
  message: string;
}

export interface BaseAuditSummary {
  baseName: string;
  sourceId: string;
  databaseId: string;
  propertyStatus: 'ok' | 'missing' | 'type_mismatch' | 'unauthorized' | 'error';
  propertyName?: string;
  propertyId?: string;
  propertyType?: string;
  statusMessage: string;
  pagesReviewed: number;
  emptyCount: number;
  correctCount: number;
  repairedCount: number;
  foreignCount: number;
  omittedCount: number;
  failedCount: number;
  pendingCount: number;
  pages: {
    pageId: string;
    title: string;
    status: 'empty' | 'exact' | 'needs_repair' | 'foreign' | 'missing_property';
    url?: string;
    reason?: string;
  }[];
  errors: { pageId?: string; reason: string; type: 'missing_property' | 'type_mismatch' | 'unauthorized' | 'deleted' | 'temporary_error' }[];
}

export interface BasesAuditReport {
  bases: BaseAuditSummary[];
  totals: {
    basesChecked: number;
    basesReady: number;
    basesPending: number;
    pagesReviewed: number;
    emptyCount: number;
    correctCount: number;
    repairedCount: number;
    foreignCount: number;
    omittedCount: number;
    failedCount: number;
    pendingCount: number;
  };
  dryRun: boolean;
  executedAt: string;
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

export interface BaseVerificationOptions {
  baseNames?: string[];
  timeoutMs?: number;
  onProgress?: (info: { baseName: string; current: number; total: number; status: string }) => void;
}

/**
 * Verifies all enabled ANFETA bases to ensure "Abrir en ANFETA" exists and is of type URL.
 * Supports filtering by baseNames (e.g. single base testing), strict per-request timeout (8s),
 * limited retries, and visible progress callback.
 */
export async function verifyEnabledBasesLinkProperty(
  settings: CalendarSettings,
  options: BaseVerificationOptions = {}
): Promise<BaseLinkVerificationResult[]> {
  const results: BaseLinkVerificationResult[] = [];
  const timeoutMs = options.timeoutMs || 8000;

  const basesToCheck = options.baseNames && options.baseNames.length > 0
    ? ANFETA_BASES.filter(([n]) => options.baseNames!.some(target => target.toLowerCase() === n.toLowerCase()))
    : ANFETA_BASES;

  for (let i = 0; i < basesToCheck.length; i++) {
    const [name, sourceId] = basesToCheck[i];
    const databaseId = NOTION_BASE_DATABASE_IDS[sourceId] || sourceId;
    const cleanDbId = databaseId.replace(/-/g, '');

    options.onProgress?.({
      baseName: name,
      current: i + 1,
      total: basesToCheck.length,
      status: 'checking',
    });

    try {
      // Direct call to official Notion databases endpoint with bounded timeout
      const schema = await notionRequest(
        { ...settings, notionSignal: AbortSignal.timeout(timeoutMs) },
        `databases/${cleanDbId}`
      );

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
            propertyId: match.id,
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
            propertyId: match.id,
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
      const isNotFound = /not_found|404/i.test(msg);
      const isForbidden = /forbidden|403/i.test(msg);
      const isTimeout = /timeout|demasiado en responder|aborted/i.test(msg);

      let status: BaseLinkVerificationResult['status'] = 'error';
      let cleanMsg = msg;
      if (isAuth) {
        status = 'unauthorized';
        cleanMsg = 'Error 401: Token de Notion no válido o revocado.';
      } else if (isNotFound) {
        cleanMsg = 'Error 404: La integración no tiene acceso a esta base o la base no existe.';
      } else if (isForbidden) {
        cleanMsg = 'Error 403: Sin permisos para consultar esta base.';
      } else if (isTimeout) {
        cleanMsg = `Tiempo de espera agotado al consultar Notion (${timeoutMs}ms).`;
      }

      results.push({
        baseName: name,
        sourceId,
        databaseId,
        status,
        message: cleanMsg,
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
 * Clears (empties to null) exclusively the "Abrir en ANFETA" property in Notion.
 * Preserves foreign non-ANFETA URLs unless explicitly overridden.
 */
export async function clearActivityLinkFromNotion(
  settings: CalendarSettings,
  pageId: string,
  options?: {
    targetPropName?: string;
    existingProperties?: Record<string, any>;
    force?: boolean;
  }
): Promise<{ success: boolean; cleared: boolean; previousUrl?: string; error?: string }> {
  const cleanId = String(pageId || '').replace(/-/g, '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(cleanId)) {
    return { success: false, cleared: false, error: 'ID de página no válido.' };
  }

  try {
    let props = options?.existingProperties;
    if (!props) {
      const page = await notionRequest(settings, `pages/${cleanId}`);
      if (page.archived || page.in_trash) {
        return { success: false, cleared: false, error: 'Página archivada o en papelera.' };
      }
      props = page.properties || {};
    }
    const targetProps: Record<string, any> = props || {};

    const propMatch = options?.targetPropName
      ? { name: options.targetPropName, type: 'url', isValid: true }
      : findActivityLinkProperty(targetProps);

    if (!propMatch || !propMatch.isValid) {
      return { success: false, cleared: false, error: 'Propiedad no encontrada o no es URL.' };
    }

    const currentUrl = targetProps[propMatch.name]?.url;
    if (!currentUrl) {
      return { success: true, cleared: false };
    }

    if (!options?.force) {
      const evaluation = evaluateActivityLink(cleanId, currentUrl);
      if (evaluation.status === 'foreign') {
        return { success: true, cleared: false, previousUrl: currentUrl };
      }
    }

    await notionRequest(settings, `pages/${cleanId}`, 'PATCH', {
      properties: {
        [propMatch.name]: { url: null },
      },
    });

    if (props && props[propMatch.name]) {
      props[propMatch.name].url = null;
    }

    return { success: true, cleared: true, previousUrl: currentUrl };
  } catch (err: any) {
    return { success: false, cleared: false, error: err?.message || 'Error al limpiar enlace.' };
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

let isBackfillJobRunning = false;

export function isLinkBackfillRunning(): boolean {
  return isBackfillJobRunning;
}

/**
 * Generates a preflight preview audit report by base for all enabled ANFETA bases.
 */
export async function auditBasesActivityLinks(
  settings: CalendarSettings,
  options: {
    maxPagesPerBase?: number;
    maxTotalPages?: number;
    paginateAll?: boolean;
    baseUrl?: string;
    timeoutMs?: number;
    baseNames?: string[];
    onProgress?: (progress: {
      baseName: string;
      stage: string;
      current: number;
      total: number;
      action?: string;
      pageTitle?: string;
    }) => void;
  } = {}
): Promise<BasesAuditReport> {
  const targetBases = options.baseNames && options.baseNames.length
    ? ANFETA_BASES.filter(([n]) => options.baseNames!.includes(n))
    : ANFETA_BASES;

  const totalLimitForBase = options.paginateAll
    ? (options.maxTotalPages || 1000)
    : Math.min(100, Math.max(1, options.maxPagesPerBase || 50));

  const report: BasesAuditReport = {
    bases: [],
    totals: {
      basesChecked: targetBases.length,
      basesReady: 0,
      basesPending: 0,
      pagesReviewed: 0,
      emptyCount: 0,
      correctCount: 0,
      repairedCount: 0,
      foreignCount: 0,
      omittedCount: 0,
      failedCount: 0,
      pendingCount: 0,
    },
    dryRun: true,
    executedAt: new Date().toISOString(),
  };

  for (const [name, sourceId] of targetBases) {
    const databaseId = NOTION_BASE_DATABASE_IDS[sourceId] || sourceId;
    const baseSummary: BaseAuditSummary = {
      baseName: name,
      sourceId,
      databaseId,
      propertyStatus: 'error',
      statusMessage: '',
      pagesReviewed: 0,
      emptyCount: 0,
      correctCount: 0,
      repairedCount: 0,
      foreignCount: 0,
      omittedCount: 0,
      failedCount: 0,
      pendingCount: 0,
      pages: [],
      errors: [],
    };

    try {
      const cleanDbId = databaseId.replace(/-/g, '');
      const timeoutMs = options.timeoutMs || 8000;
      const schema = await notionRequest(
        { ...settings, notionSignal: AbortSignal.timeout(timeoutMs) },
        `databases/${cleanDbId}`
      );

      if (!schema || !schema.properties) {
        baseSummary.propertyStatus = 'error';
        baseSummary.statusMessage = 'No se pudo leer el esquema de la base.';
        baseSummary.errors.push({ reason: 'Esquema de base no disponible.', type: 'temporary_error' });
        report.bases.push(baseSummary);
        report.totals.basesPending++;
        continue;
      }

      const match = findActivityLinkProperty(schema.properties);
      if (!match) {
        baseSummary.propertyStatus = 'missing';
        baseSummary.statusMessage = 'Falta crear la propiedad "Abrir en ANFETA" (tipo URL).';
        baseSummary.errors.push({ reason: 'Propiedad no encontrada en la base.', type: 'missing_property' });
        report.bases.push(baseSummary);
        report.totals.basesPending++;
        continue;
      }

      if (!match.isValid) {
        baseSummary.propertyStatus = 'type_mismatch';
        baseSummary.propertyName = match.name;
        baseSummary.propertyId = match.id;
        baseSummary.propertyType = match.type;
        baseSummary.statusMessage = match.error || `La propiedad "${match.name}" es de tipo ${match.type}, debe ser URL.`;
        baseSummary.errors.push({ reason: baseSummary.statusMessage, type: 'type_mismatch' });
        report.bases.push(baseSummary);
        report.totals.basesPending++;
        continue;
      }

      baseSummary.propertyStatus = 'ok';
      baseSummary.propertyName = match.name;
      baseSummary.propertyId = match.id;
      baseSummary.propertyType = match.type;
      baseSummary.statusMessage = `Propiedad "${match.name}" verificada (tipo URL).`;
      report.totals.basesReady++;

      // Query pages in this database with pagination support
      try {
        let hasMore = true;
        let nextCursor: string | undefined = undefined;
        let pagesProcessedInBase = 0;

        while (hasMore && pagesProcessedInBase < totalLimitForBase) {
          const currentBatchSize = Math.min(100, totalLimitForBase - pagesProcessedInBase);
          const queryBody: Record<string, any> = { page_size: currentBatchSize };
          if (nextCursor) {
            queryBody.start_cursor = nextCursor;
          }

          const queryRes = await notionRequest(settings, `databases/${cleanDbId}/query`, 'POST', queryBody);
          const pages = queryRes.results || [];
          hasMore = Boolean(queryRes.has_more && queryRes.next_cursor);
          nextCursor = queryRes.next_cursor || undefined;

          if (pages.length === 0) break;

          for (const page of pages) {
            pagesProcessedInBase++;
            if (page.archived || page.in_trash) {
              baseSummary.omittedCount++;
              report.totals.omittedCount++;
              continue;
            }

            baseSummary.pagesReviewed++;
            report.totals.pagesReviewed++;

            const cleanId = String(page.id).replace(/-/g, '').toLowerCase();
            const props = page.properties || {};

            let pageTitle = 'Sin título';
            const titleEntry = Object.values(props).find((p: any) => p?.type === 'title') as any;
            if (titleEntry?.title && Array.isArray(titleEntry.title) && titleEntry.title.length) {
              pageTitle = titleEntry.title.map((t: any) => t.plain_text || t.text?.content || '').join('').trim() || 'Sin título';
            }

            const curUrl = props[match.name]?.url;
            const evaluation = evaluateActivityLink(cleanId, curUrl, { baseUrl: options.baseUrl });

            if (evaluation.status === 'empty') {
              baseSummary.emptyCount++;
              baseSummary.pendingCount++;
              report.totals.emptyCount++;
              report.totals.pendingCount++;
              baseSummary.pages.push({
                pageId: cleanId,
                title: pageTitle,
                status: 'empty',
                url: evaluation.canonicalUrl,
                reason: 'Propiedad vacía; lista para autocompletar.',
              });
            } else if (evaluation.status === 'exact') {
              baseSummary.correctCount++;
              report.totals.correctCount++;
              baseSummary.pages.push({
                pageId: cleanId,
                title: pageTitle,
                status: 'exact',
                url: curUrl,
                reason: 'Enlace canónico ya actualizado.',
              });
            } else if (evaluation.status === 'needs_repair') {
              baseSummary.repairedCount++;
              baseSummary.pendingCount++;
              report.totals.repairedCount++;
              report.totals.pendingCount++;
              baseSummary.pages.push({
                pageId: cleanId,
                title: pageTitle,
                status: 'needs_repair',
                url: evaluation.canonicalUrl,
                reason: evaluation.reason || 'Enlace requiere reparación.',
              });
            } else if (evaluation.status === 'foreign') {
              baseSummary.foreignCount++;
              report.totals.foreignCount++;
              baseSummary.pages.push({
                pageId: cleanId,
                title: pageTitle,
                status: 'foreign',
                url: curUrl,
                reason: 'URL ajena externa; se conserva intacta.',
              });
            }

            options.onProgress?.({
              baseName: name,
              stage: 'Auditoría',
              current: pagesProcessedInBase,
              total: totalLimitForBase,
              pageTitle,
              action: evaluation.status,
            });
          }
        }
      } catch (queryErr: any) {
        baseSummary.failedCount++;
        report.totals.failedCount++;
        baseSummary.errors.push({
          reason: queryErr?.message || 'Error al consultar registros de la base.',
          type: 'temporary_error',
        });
      }
    } catch (baseErr: any) {
      const msg = baseErr?.message || 'Error al conectar con la base.';
      const isAuth = /unauthorized|token|401|403/i.test(msg);
      baseSummary.propertyStatus = isAuth ? 'unauthorized' : 'error';
      baseSummary.statusMessage = msg;
      baseSummary.errors.push({
        reason: msg,
        type: isAuth ? 'unauthorized' : 'temporary_error',
      });
      report.totals.basesPending++;
    }

    report.bases.push(baseSummary);
  }

  return report;
}

/**
 * Executes batch link backfilling across verified bases.
 * Guards against concurrent runs and respects API rate limits.
 */
export async function executeBasesBackfill(
  settings: CalendarSettings,
  options: {
    baseNames?: string[];
    limitPerBase?: number;
    maxTotalPages?: number;
    paginateAll?: boolean;
    delayMs?: number;
    dryRun?: boolean;
    cleanFirst?: boolean;
    baseUrl?: string;
    timeoutMs?: number;
    onProgress?: (progress: {
      baseName: string;
      stage: string;
      current: number;
      total: number;
      action?: string;
      pageTitle?: string;
    }) => void;
  } = {}
): Promise<BasesAuditReport> {
  if (isBackfillJobRunning) {
    throw new Error('Ya hay una sincronización de enlaces en ejecución.');
  }

  isBackfillJobRunning = true;
  try {
    const dryRun = options.dryRun !== false;
    const totalLimitForBase = options.paginateAll
      ? (options.maxTotalPages || 1000)
      : Math.min(100, Math.max(1, options.limitPerBase || 50));
    const delayMs = typeof options.delayMs === 'number' ? options.delayMs : 150;

    const report: BasesAuditReport = {
      bases: [],
      totals: {
        basesChecked: ANFETA_BASES.length,
        basesReady: 0,
        basesPending: 0,
        pagesReviewed: 0,
        emptyCount: 0,
        correctCount: 0,
        repairedCount: 0,
        foreignCount: 0,
        omittedCount: 0,
        failedCount: 0,
        pendingCount: 0,
      },
      dryRun,
      executedAt: new Date().toISOString(),
    };

    const targetBases = options.baseNames && options.baseNames.length
      ? ANFETA_BASES.filter(([n]) => options.baseNames!.includes(n))
      : ANFETA_BASES;

    for (const [name, sourceId] of targetBases) {
      const databaseId = NOTION_BASE_DATABASE_IDS[sourceId] || sourceId;
      const baseSummary: BaseAuditSummary = {
        baseName: name,
        sourceId,
        databaseId,
        propertyStatus: 'error',
        statusMessage: '',
        pagesReviewed: 0,
        emptyCount: 0,
        correctCount: 0,
        repairedCount: 0,
        foreignCount: 0,
        omittedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        pages: [],
        errors: [],
      };

      try {
        const cleanDbId = databaseId.replace(/-/g, '');
        const timeoutMs = options.timeoutMs || 8000;
        const schema = await notionRequest(
          { ...settings, notionSignal: AbortSignal.timeout(timeoutMs) },
          `databases/${cleanDbId}`
        );

        if (!schema || !schema.properties) {
          baseSummary.propertyStatus = 'error';
          baseSummary.statusMessage = 'No se pudo leer el esquema de la base.';
          report.bases.push(baseSummary);
          report.totals.basesPending++;
          continue;
        }

        const match = findActivityLinkProperty(schema.properties);
        if (!match || !match.isValid) {
          baseSummary.propertyStatus = match ? 'type_mismatch' : 'missing';
          baseSummary.statusMessage = match?.error || 'Falta la propiedad "Abrir en ANFETA" (tipo URL).';
          report.bases.push(baseSummary);
          report.totals.basesPending++;
          continue;
        }

        baseSummary.propertyStatus = 'ok';
        baseSummary.propertyName = match.name;
        baseSummary.propertyId = match.id;
        baseSummary.propertyType = match.type;
        baseSummary.statusMessage = `Propiedad "${match.name}" verificada.`;
        report.totals.basesReady++;

        // Query pages in this database with pagination support
        let hasMore = true;
        let nextCursor: string | undefined = undefined;
        let pagesProcessedInBase = 0;

        while (hasMore && pagesProcessedInBase < totalLimitForBase) {
          const currentBatchSize = Math.min(100, totalLimitForBase - pagesProcessedInBase);
          const queryBody: Record<string, any> = { page_size: currentBatchSize };
          if (nextCursor) {
            queryBody.start_cursor = nextCursor;
          }

          const queryRes = await notionRequest(settings, `databases/${cleanDbId}/query`, 'POST', queryBody);
          const pages = queryRes.results || [];
          hasMore = Boolean(queryRes.has_more && queryRes.next_cursor);
          nextCursor = queryRes.next_cursor || undefined;

          if (pages.length === 0) break;

          for (const page of pages) {
            pagesProcessedInBase++;
            if (page.archived || page.in_trash) {
              baseSummary.omittedCount++;
              report.totals.omittedCount++;
              continue;
            }

            baseSummary.pagesReviewed++;
            report.totals.pagesReviewed++;

            const cleanId = String(page.id).replace(/-/g, '').toLowerCase();
            const props = page.properties || {};

            let pageTitle = 'Sin título';
            const titleEntry = Object.values(props).find((p: any) => p?.type === 'title') as any;
            if (titleEntry?.title && Array.isArray(titleEntry.title) && titleEntry.title.length) {
              pageTitle = titleEntry.title.map((t: any) => t.plain_text || t.text?.content || '').join('').trim() || 'Sin título';
            }

            const curUrl = props[match.name]?.url;
            const evaluation = evaluateActivityLink(cleanId, curUrl, { baseUrl: options.baseUrl });

            if (evaluation.status === 'exact') {
              baseSummary.correctCount++;
              report.totals.correctCount++;
              baseSummary.pages.push({
                pageId: cleanId,
                title: pageTitle,
                status: 'exact',
                url: curUrl,
              });
              options.onProgress?.({
                baseName: name,
                stage: 'Llenado',
                current: pagesProcessedInBase,
                total: totalLimitForBase,
                pageTitle,
                action: 'exact',
              });
              continue;
            }

            if (evaluation.status === 'foreign') {
              baseSummary.foreignCount++;
              report.totals.foreignCount++;
              baseSummary.pages.push({
                pageId: cleanId,
                title: pageTitle,
                status: 'foreign',
                url: curUrl,
                reason: 'URL ajena conservada.',
              });
              options.onProgress?.({
                baseName: name,
                stage: 'Llenado',
                current: pagesProcessedInBase,
                total: totalLimitForBase,
                pageTitle,
                action: 'foreign',
              });
              continue;
            }

            const action = evaluation.status === 'empty' ? 'filled' : 'repaired';

            if (dryRun) {
              if (action === 'filled') {
                baseSummary.emptyCount++;
                report.totals.emptyCount++;
              } else {
                baseSummary.repairedCount++;
                report.totals.repairedCount++;
              }
              baseSummary.pages.push({
                pageId: cleanId,
                title: pageTitle,
                status: evaluation.status,
                url: evaluation.canonicalUrl,
                reason: action === 'filled' ? 'Por completar' : 'Por reparar',
              });
            } else {
              // Write to Notion
              try {
                if (options.cleanFirst && curUrl) {
                  await clearActivityLinkFromNotion(settings, cleanId, {
                    targetPropName: match.name,
                    existingProperties: props,
                  });
                }

                if (delayMs > 0) {
                  await new Promise((resolve) => setTimeout(resolve, delayMs));
                }

                const writeRes = await saveActivityLinkToNotion(settings, cleanId, {
                  targetPropName: match.name,
                  baseUrl: options.baseUrl,
                  existingProperties: props,
                });

                if (writeRes.success) {
                  if (action === 'filled') {
                    baseSummary.emptyCount++;
                    report.totals.emptyCount++;
                  } else {
                    baseSummary.repairedCount++;
                    report.totals.repairedCount++;
                  }
                  baseSummary.pages.push({
                    pageId: cleanId,
                    title: pageTitle,
                    status: evaluation.status,
                    url: evaluation.canonicalUrl,
                    reason: action === 'filled' ? 'Completado' : 'Reparado',
                  });
                } else {
                  baseSummary.failedCount++;
                  report.totals.failedCount++;
                  baseSummary.errors.push({
                    pageId: cleanId,
                    reason: writeRes.error || 'Error al guardar enlace.',
                    type: 'temporary_error',
                  });
                }
              } catch (err: any) {
                baseSummary.failedCount++;
                report.totals.failedCount++;
                baseSummary.errors.push({
                  pageId: cleanId,
                  reason: err?.message || 'Error de red al actualizar página.',
                  type: 'temporary_error',
                });
              }
            }

            options.onProgress?.({
              baseName: name,
              stage: 'Llenado',
              current: pagesProcessedInBase,
              total: totalLimitForBase,
              pageTitle,
              action,
            });
          }
        }
      } catch (err: any) {
        baseSummary.failedCount++;
        report.totals.failedCount++;
        baseSummary.errors.push({
          reason: err?.message || 'Error al procesar la base.',
          type: 'temporary_error',
        });
      }

      report.bases.push(baseSummary);
    }

    return report;
  } finally {
    isBackfillJobRunning = false;
  }
}
