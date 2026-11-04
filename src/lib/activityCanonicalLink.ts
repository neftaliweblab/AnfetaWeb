export interface ActivityLinkEvaluation {
  status: 'empty' | 'exact' | 'needs_repair' | 'foreign' | 'missing_property';
  canonicalUrl: string;
  existingUrl?: string;
  propertyName?: string;
  detectedId?: string;
  reason?: string;
}

/**
 * Resolves the configured canonical public base URL.
 * Strictly avoids localhost, 127.0.0.1, or Vercel preview/branch URLs.
 */
export function getPublicBaseUrl(customBaseUrl?: string): string {
  if (customBaseUrl && isValidPublicUrl(customBaseUrl)) {
    return cleanBaseUrl(customBaseUrl);
  }

  const envPublic = (
    process.env.ANFETA_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ''
  ).trim();

  if (envPublic && isValidPublicUrl(envPublic)) {
    return cleanBaseUrl(envPublic);
  }

  const vercelProd = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  if (vercelProd && isValidPublicUrl(vercelProd)) {
    return cleanBaseUrl(vercelProd.startsWith('http') ? vercelProd : `https://${vercelProd}`);
  }

  // Official production domain default
  return 'https://anfeta.com';
}

function cleanBaseUrl(url: string): string {
  return url.replace(/\/+$/, '').trim();
}

/**
 * Resolves public base URL from incoming NextRequest headers if it's a valid public domain.
 */
export function resolvePublicBaseUrlFromRequest(req?: any): string | undefined {
  if (!req || !req.headers) return undefined;
  try {
    const host = (req.headers.get?.('x-forwarded-host') || req.headers.get?.('host') || '').trim();
    if (!host) return undefined;
    const proto = (req.headers.get?.('x-forwarded-proto') || 'https').split(',')[0].trim();
    const candidate = `${proto}://${host}`;
    return isValidPublicUrl(candidate) ? cleanBaseUrl(candidate) : undefined;
  } catch {
    return undefined;
  }
}

function isValidPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false;
    // Reject preview or branch deploys on vercel
    if (host.includes('-git-') || host.includes('.preview.')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds canonical direct URL for an ANFETA activity.
 * Format: https://<domain>/calendar?activity=<pageId32>
 */
export function canonicalActivityUrl(pageId: string, options?: { baseUrl?: string }): string {
  const cleanId = String(pageId || '').replace(/-/g, '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(cleanId)) {
    return '';
  }
  const base = getPublicBaseUrl(options?.baseUrl);
  return `${base}/calendar?activity=${cleanId}`;
}

/**
 * Finds the "Abrir en ANFETA" property in page or database schema.
 * Matches exact name "Abrir en ANFETA" (case-insensitive) or any URL property containing "anfeta".
 */
export function findActivityLinkProperty(properties: Record<string, any> = {}): {
  id?: string;
  name: string;
  type: string;
  isValid: boolean;
  error?: string;
} | null {
  const entries = Object.entries(properties);

  // 1. Exact match for "Abrir en ANFETA"
  const exact = entries.find(([name]) => /^abrir en anfeta$/i.test(name.trim()));
  if (exact) {
    const [name, prop] = exact;
    if (prop?.type === 'url') {
      return { id: prop?.id, name, type: 'url', isValid: true };
    }
    return {
      id: prop?.id,
      name,
      type: prop?.type || 'unknown',
      isValid: false,
      error: `La propiedad "${name}" existe pero es de tipo "${prop?.type}", no "url".`,
    };
  }

  // 2. Fallback: Any URL property referencing anfeta
  const fallback = entries.find(([name, prop]) => prop?.type === 'url' && /abrir en anfeta|anfeta/i.test(name));
  if (fallback) {
    return { id: fallback[1]?.id, name: fallback[0], type: 'url', isValid: true };
  }

  // 3. Fallback: Any URL property referencing enlace anfeta
  const linkProp = entries.find(([name, prop]) => prop?.type === 'url' && /enlace/i.test(name));
  if (linkProp) {
    return { id: linkProp[1]?.id, name: linkProp[0], type: 'url', isValid: true };
  }

  return null;
}

/**
 * Analyzes the status of an existing URL property in a page.
 */
export function evaluateActivityLink(
  pageId: string,
  existingUrl: string | undefined | null,
  options?: { baseUrl?: string }
): ActivityLinkEvaluation {
  const canonical = canonicalActivityUrl(pageId, options);
  const cleanId = String(pageId).replace(/-/g, '').toLowerCase();
  const raw = String(existingUrl || '').trim();

  if (!raw) {
    return { status: 'empty', canonicalUrl: canonical };
  }

  if (raw === canonical) {
    return { status: 'exact', canonicalUrl: canonical, existingUrl: raw };
  }

  // Check if it's an ANFETA activity URL
  try {
    const parsed = new URL(raw);
    const paramId = (parsed.searchParams.get('activity') || parsed.searchParams.get('pageId') || '').replace(/-/g, '').toLowerCase();

    if (paramId) {
      // It is an ANFETA activity URL
      if (paramId === cleanId) {
        // Same activity ID, but outdated domain, preview url, localhost, or old path (/?activity=)
        return {
          status: 'needs_repair',
          canonicalUrl: canonical,
          existingUrl: raw,
          detectedId: paramId,
          reason: 'URL propia de ANFETA con dominio desactualizado, localhost o ruta previa.',
        };
      }
      // Different activity ID (e.g. copied from template without updating)
      return {
        status: 'needs_repair',
        canonicalUrl: canonical,
        existingUrl: raw,
        detectedId: paramId,
        reason: `URL heredada de otra actividad (${paramId}). Requiere el ID propio (${cleanId}).`,
      };
    }
  } catch {}

  // Foreign / third-party URL (e.g. Dropbox, Google Drive, external portal)
  return {
    status: 'foreign',
    canonicalUrl: canonical,
    existingUrl: raw,
    reason: 'URL externa o ajena configurada. Se conserva intacta.',
  };
}
