export interface WhatsappGroup {
  group_id: string;
  name: string;
  access_url: string | null;
  last_seen_at: string;
}
export interface WhatsappBinding { group_id: string; page_id: string; activity_title: string }
export function whatsappGroupId(value: unknown): string {
  const id = typeof value === 'string' ? value : (value as any)?._serialized;
  if (typeof id !== 'string' || !/^\d+(?:-\d+)?@g\.us$/.test(id)) throw Error('Identificador de grupo no válido.');
  return id;
}
export function normalizedWhatsappGroups(value: unknown): {id: string; name: string}[] {
  if (!Array.isArray(value)) throw Error('WAHA devolvió una lista de grupos no compatible con WEBJS.');
  const unique = new Map<string, {id: string; name: string}>();
  for (const row of value) {
    const id = whatsappGroupId(row?.id);
    const name = row?.name || row?.groupMetadata?.subject || row?.subject;
    if (typeof name !== 'string' || !name.trim() || name.length > 1024) throw Error('Hay un grupo sin nombre válido; no se confirmó este lote.');
    unique.set(id, {id, name: name.trim()});
  }
  return [...unique.values()];
}
export function whatsappAccessUrl(value: unknown): string | null {
  if (value === '' || value === null) return null;
  if (typeof value !== 'string' || value.length > 512) throw Error('Enlace de WhatsApp no válido.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw Error('Enlace de WhatsApp no válido.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'chat.whatsapp.com' || url.username || url.password || url.port || !/^\/[a-zA-Z0-9_-]{10,128}\/?$/.test(url.pathname)) throw Error('Usa un enlace de grupo de https://chat.whatsapp.com/.');
  url.hash = ''; url.search = '';
  return url.toString();
}
function normalized(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function domains(value: string) { return new Set(normalized(value).match(/(?:[a-z0-9-]+\.)+[a-z]{2,}/g) || []); }
function words(value: string) {
  const ignore = new Set(['revision','prtuzrevision','rtuzrevision','zrevision','web','webs','grupo','actividad','para','con','del','las','los','una','gena','john','neft','rapido']);
  return new Set(normalized(value).split(/[^a-z0-9]+/).filter(w => w.length > 3 && !ignore.has(w) && !/^\d+$/.test(w)));
}
export function whatsappMatchScore(groupName: string, activityTitle: string): number {
  const gd = domains(groupName), ad = domains(activityTitle);
  const domainMatch = [...gd].some(d => ad.has(d));
  if (gd.size && ad.size && !domainMatch) return 0;
  const gw = words(groupName), aw = words(activityTitle);
  const overlap = [...gw].filter(w => aw.has(w)).length;
  return domainMatch ? 100 + overlap : overlap >= 2 ? overlap : 0;
}
