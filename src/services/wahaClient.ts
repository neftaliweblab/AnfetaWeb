import {normalizedWhatsappGroups, whatsappGroupId, whatsappAccessUrl} from '@/lib/whatsappGroups';

export class WahaError extends Error { constructor(message: string, public status = 502) { super(message); } }
type Transport = typeof fetch;
export type WhatsappOwner = 'John' | 'Neftali';
function connectionConfig(owner: WhatsappOwner) {
  const prefix=owner==='Neftali'?'WAHA_NEFTALI_':'WAHA_';
  return {base:process.env[prefix+'BASE_URL']?.replace(/\/+$/, ''),key:process.env[prefix+'API_KEY'],name:process.env[prefix+'SESSION']||'default'};
}
export function wahaConfigured(owner: WhatsappOwner='John') { const c=connectionConfig(owner);return Boolean(c.base&&c.key); }
export function createWahaClient(transport: Transport = fetch, owner: WhatsappOwner='John') {
  const {base,key,name}=connectionConfig(owner);
  if (!base || !key) throw new WahaError('Falta configurar el servicio de WhatsApp en el servidor.', 503);
  const url = new URL(base);
  const other=connectionConfig(owner==='John'?'Neftali':'John');
  if(other.base && new URL(other.base).href.replace(/\/+$/, '')===url.href.replace(/\/+$/, '') && other.name===name) throw new WahaError('John y Neftalí deben tener conexiones de WhatsApp separadas.',503);
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new WahaError('WAHA necesita una URL HTTPS, o localhost para pruebas.', 503);
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) throw new WahaError('Nombre de sesión de WAHA no válido.', 503);
  async function request(path: string, method = 'GET', body?: unknown) {
    let response: Response;
    try {
      response = await transport(base + '/api/' + path, {method, headers: {'X-Api-Key': key!, Accept: 'application/json', ...(body === undefined ? {} : {'Content-Type': 'application/json'})}, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000)});
    } catch { throw new WahaError('El servicio de WhatsApp no respondió. Puedes volver a consultar.'); }
    if (!response.ok) throw new WahaError(response.status === 404 ? 'No hay una sesión de WhatsApp creada.' : response.status === 401 || response.status === 403 ? 'Revisa la clave del servicio de WhatsApp en el servidor.' : 'WAHA no confirmó la operación. Revisa el estado de la sesión.', response.status === 404 ? 404 : 502);
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { throw new WahaError('WAHA devolvió una respuesta no compatible.'); }
  }
  async function status(checkEngine = true) {
    try {
      const value = await request('sessions/' + name);
      // A dedicated WEBJS instance is required; never silently switch engines.
      if (checkEngine && value?.engine?.engine && value.engine.engine !== 'WEBJS') throw new WahaError('Configura WAHA con el motor WEBJS.', 409);
      return {status: String(value?.status || 'UNKNOWN')};
    } catch (error) { if (error instanceof WahaError && error.status === 404) return {status: 'ABSENT'}; throw error; }
  }
  return {
    status,
    async start() {
      const current = await status();
      if (current.status === 'ABSENT') await request('sessions', 'POST', {name, start: true, config: {webhooks: [], ignore: {status: true, channels: true, broadcast: true}}});
      else if (current.status === 'STOPPED') await request('sessions/' + name + '/start', 'POST');
      else if (!['WORKING','STARTING','SCAN_QR_CODE'].includes(current.status)) throw new WahaError('La sesión requiere atención. Desvincúlala antes de volver a conectar.', 409);
      return status();
    },
    async qr() {
      if ((await status()).status !== 'SCAN_QR_CODE') throw new WahaError('El QR todavía no está disponible. Actualiza el estado.', 409);
      const value = await request(name + '/auth/qr?format=image');
      if (value?.mimetype !== 'image/png' || typeof value.data !== 'string' || value.data.length > 600000 || !/^[a-zA-Z0-9+/=\r\n]+$/.test(value.data)) throw new WahaError('No se recibió un QR válido.');
      return 'data:image/png;base64,' + value.data;
    },
    async groups(offset: number) {
      if ((await status()).status !== 'WORKING') throw new WahaError('Vincula WhatsApp y espera a que la sesión esté lista.', 409);
      const me = await request('sessions/' + name + '/me');
      const account = typeof me?.id === 'string' ? me.id : me?.id?._serialized;
      if (typeof account !== 'string' || !/^\d+(?::\d+)?@(?:c\.us|s\.whatsapp\.net|lid)$/.test(account)) throw new WahaError('No se confirmó la identidad de la cuenta de WhatsApp.');
      const count = await request(name + '/groups/count');
      if (!Number.isSafeInteger(count?.count) || count.count < 0 || count.count > 10000) throw new WahaError('No se confirmó el total de grupos de esta sesión.');
      const raw = await request(name + '/groups?limit=50&offset=' + offset + '&sortBy=id&sortOrder=asc&exclude=participants');
      const groups = normalizedWhatsappGroups(raw);
      if (raw.length > 50 || groups.length !== raw.length || (raw.length < 50 && offset + raw.length < count.count) || offset + raw.length > count.count) throw new WahaError('La lista de grupos cambió o no se paginó correctamente. Repite la importación.');
      return {account: account.replace(/:\d+@/, '@'), groups, total: count.count, nextOffset: offset + raw.length, done: offset + raw.length >= count.count};
    },
    async invite(groupId: string) {
      const id = whatsappGroupId(groupId);
      if ((await status()).status !== 'WORKING') throw new WahaError('Conecta WhatsApp para consultar el enlace vigente.', 409);
      const code = await request(name + '/groups/' + encodeURIComponent(id) + '/invite-code');
      if (typeof code !== 'string' || !/^[a-zA-Z0-9_-]{10,128}$/.test(code)) throw new WahaError('No se pudo obtener el enlace. Revisa tus permisos en el grupo.');
      return whatsappAccessUrl('https://chat.whatsapp.com/' + code);
    },
    async disconnect() {
      if ((await status(false)).status === 'ABSENT') return {disconnected: true};
      // Stop alone leaves authentication behind. Logout must succeed before deletion.
      await request('sessions/' + name + '/logout', 'POST');
      try { await request('sessions/' + name, 'DELETE'); } catch (error) { if (!(error instanceof WahaError && error.status === 404)) throw error; }
      if ((await status(false)).status !== 'ABSENT') throw new WahaError('No se confirmó la eliminación de la sesión. Revisa Dispositivos vinculados en el teléfono.');
      return {disconnected: true};
    },
  };
}
