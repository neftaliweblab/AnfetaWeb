export async function uploadDropboxCloud(filename: string, bytes: Buffer, folder: string) {
  const token = process.env.DROPBOX_ACCESS_TOKEN;
  if (!token) throw new Error('Configura DROPBOX_ACCESS_TOKEN para subir a Dropbox desde Vercel.');
  const safeName = filename.replace(/.*[\\/]/, '').replace(/[\x00-\x1f]/g, '').trim();
  if (!safeName || safeName === '.' || safeName === '..') throw new Error('Nombre de archivo inválido.');
  const segments = folder.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.some(part => part === '..' || part === '.')) throw new Error('Ruta de Dropbox inválida.');
  let destination = '';
  for (const segment of segments) {
    destination += '/' + segment;
    const response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: destination, autorename: false }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      const error = await response.json();
      if (response.status !== 409 || !String(error.error_summary || '').startsWith('path/conflict/folder')) throw new Error(error.error_summary || 'Dropbox rechazó la carpeta destino.');
    }
  }
  const args = JSON.stringify({ path: `${destination}/${safeName}`, mode: 'overwrite', autorename: false, mute: false }).replace(/[\u007f-\uffff]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
  const response = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': args, 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(bytes).buffer, signal: AbortSignal.timeout(60000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_summary || 'Dropbox rechazó la subida.');
  return { success: true, path: data.path_display, filename: data.name, targetDir: destination, sizeBytes: data.size, modifiedDate: data.server_modified };
}
export function cloudFolder(domain: string | undefined, target: string | undefined, localRoot: string) {
  if (domain) return `/DRX/${domain.replace(/[^a-z0-9.-]/gi, '')}.proyecto`;
  if (!target) return '/DRX';
  const normalized = target.replace(/\\/g, '/');
  const root = localRoot.replace(/\\/g, '/').replace(/\/$/, '');
  if (normalized.toLowerCase().startsWith(root.toLowerCase() + '/')) return normalized.slice(root.length);
  if (normalized.startsWith('/') && !normalized.includes('..')) return normalized;
  throw new Error('La carpeta debe estar dentro de Dropbox.');
}
