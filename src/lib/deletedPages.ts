export const DELETED_PAGES_EVENT = 'anfeta_deleted_pages';
export const PAGE_SYNC_CHANNEL = 'anfeta_page_sync';
export const pageIdentity = (value: any) =>
  String(value?.externalId || value?.originalPageId || value?.pageId || value?.id || value || '')
    .replace(/^review-mirror-/, '')
    .replace(/-/g, '')
    .toLowerCase();

const unverifiedMap = new Map<string, { reason: string; timestamp: number }>();

export function getUnverifiedPageReason(id: string): string | null {
  const clean = pageIdentity(id);
  const entry = unverifiedMap.get(clean);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > 5 * 60 * 1000) {
    unverifiedMap.delete(clean);
    return null;
  }
  return entry.reason;
}

export function setUnverifiedPage(id: string, reason?: string) {
  const clean = pageIdentity(id);
  if (!/^[a-f0-9]{32}$/.test(clean)) return;
  unverifiedMap.set(clean, {
    reason: reason || 'No se puede verificar esta página: puede no existir o faltar acceso a la integración. Actualiza o revisa los permisos.',
    timestamp: Date.now()
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('anfeta_unverified_pages', { detail: { id: clean } }));
  }
}

export function clearUnverifiedPage(id: string) {
  const clean = pageIdentity(id);
  if (unverifiedMap.delete(clean) && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('anfeta_unverified_pages', { detail: { id: clean } }));
  }
}

let syncBroadcastChannel: BroadcastChannel | null = null;
function getBroadcastChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!syncBroadcastChannel) {
    try {
      syncBroadcastChannel = new BroadcastChannel(PAGE_SYNC_CHANNEL);
    } catch {}
  }
  return syncBroadcastChannel;
}

export function broadcastPageSync(message: { type: 'deleted' | 'restored' | 'updated'; owner: string; ids: string[]; states?: any[] }) {
  const channel = getBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage(message);
    } catch {}
  }
}

export function deletedPages(owner: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem('anfeta-deleted-pages:' + owner) || '[]'));
  } catch {
    return new Set();
  }
}

export function filterDeletedPages<T>(rows: T[], owner: string) {
  const ids = deletedPages(owner);
  return rows.filter(row => !ids.has(pageIdentity(row)));
}

export function restoreConfirmedPages(owner: string, values: string[]) {
  const ids = deletedPages(owner), before = ids.size;
  for (const value of values) {
    const clean = pageIdentity(value);
    ids.delete(clean);
    clearUnverifiedPage(clean);
  }
  if (ids.size === before) return;
  try {
    localStorage.setItem('anfeta-deleted-pages:' + owner, JSON.stringify([...ids]));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DELETED_PAGES_EVENT, { detail: { owner, ids: [...ids] } }));
    broadcastPageSync({ type: 'restored', owner, ids: values.map(pageIdentity) });
  }
}

export function rememberDeletedPages(owner: string, values: string[]) {
  const ids = deletedPages(owner), before = ids.size;
  const added: string[] = [];
  for (const id of values) {
    const clean = pageIdentity(id);
    if (/^[a-f0-9]{32}$/.test(clean)) {
      ids.add(clean);
      clearUnverifiedPage(clean);
      added.push(clean);
    }
  }
  if (ids.size === before) return;
  try {
    localStorage.setItem('anfeta-deleted-pages:' + owner, JSON.stringify([...ids]));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DELETED_PAGES_EVENT, { detail: { owner, ids: [...ids] } }));
    broadcastPageSync({ type: 'deleted', owner, ids: added });
  }
}
