import {drxFolder} from '@/lib/drxUploadPlan';
import {getSettings} from '@/services/serverSettings';
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getDropboxAccessToken(tokenOverride?: string): Promise<string> {
  if (tokenOverride) return tokenOverride;

  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

  // Si tenemos refresh token + app key + app secret, auto-renovamos de por vida
  if (refreshToken && appKey && appSecret) {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
      return cachedToken.token;
    }
    try {
      const basic = Buffer.from(`${appKey}:${appSecret}`).toString('base64');
      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: appKey,
          client_secret: appSecret,
        }),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        const expiresInMs = (data.expires_in || 14400) * 1000;
        cachedToken = {
          token: data.access_token,
          expiresAt: Date.now() + expiresInMs,
        };
        return data.access_token;
      }
      const errDetail = data.error_description || data.error || JSON.stringify(data);
      console.error('Dropbox OAuth token error:', errDetail);
      throw new Error(`Dropbox OAuth error: ${errDetail}`);
    } catch (e: any) {
      console.error('Error auto-renovando Dropbox access token con refresh token:', e);
      if (e?.message?.includes('Dropbox OAuth error')) {
        throw e;
      }
    }
  }

  // Fallback a variable simple DROPBOX_ACCESS_TOKEN o ajustes
  const fallback = process.env.DROPBOX_ACCESS_TOKEN || getSettings().dropboxToken;
  if (!fallback) {
    throw new Error('Configura DROPBOX_ACCESS_TOKEN o (DROPBOX_REFRESH_TOKEN + DROPBOX_APP_KEY + DROPBOX_APP_SECRET) en Vercel.');
  }
  return fallback;
}

export async function uploadDropboxCloud(filename: string, bytes: Buffer, folder: string, tokenOverride?: string) {
  const token = await getDropboxAccessToken(tokenOverride);
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
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks
  const totalSize = bytes.length;

  if (totalSize <= 8 * 1024 * 1024) {
    // Archivos pequeños (<= 8MB): subida directa
    const args = JSON.stringify({ path: `${destination}/${safeName}`, mode: 'overwrite', autorename: false, mute: false }).replace(/[\u007f-\uffff]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': args, 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(bytes).buffer, signal: AbortSignal.timeout(60000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_summary || 'Dropbox rechazó la subida.');
    return { success: true, path: data.path_display, filename: data.name, targetDir: destination, sizeBytes: data.size, modifiedDate: data.server_modified };
  }

  // Archivos grandes (> 8MB): sesión por chunks (upload_session/start, append_v2, finish)
  // 1. Iniciar sesión con el primer chunk
  const firstChunk = bytes.subarray(0, CHUNK_SIZE);
  const startArgs = JSON.stringify({ close: false });
  const startRes = await fetch('https://content.dropboxapi.com/2/files/upload_session/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': startArgs, 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(firstChunk).buffer,
    signal: AbortSignal.timeout(60000),
  });
  const startData = await startRes.json();
  if (!startRes.ok) throw new Error(startData.error_summary || 'Dropbox rechazó iniciar la sesión de subida.');

  const sessionId = startData.session_id;
  let offset = firstChunk.length;

  // 2. Subir chunks intermedios
  while (offset + CHUNK_SIZE < totalSize) {
    const nextChunk = bytes.subarray(offset, offset + CHUNK_SIZE);
    const appendArgs = JSON.stringify({
      cursor: { session_id: sessionId, offset },
      close: false,
    });
    const appendRes = await fetch('https://content.dropboxapi.com/2/files/upload_session/append_v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': appendArgs, 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(nextChunk).buffer,
      signal: AbortSignal.timeout(60000),
    });
    if (!appendRes.ok) {
      const appendData = await appendRes.json();
      throw new Error(appendData.error_summary || 'Error en bloque de subida de Dropbox.');
    }
    offset += nextChunk.length;
  }

  // 3. Finalizar sesión con el último bloque
  const lastChunk = bytes.subarray(offset);
  const finishArgs = JSON.stringify({
    cursor: { session_id: sessionId, offset },
    commit: { path: `${destination}/${safeName}`, mode: 'overwrite', autorename: false, mute: false },
  }).replace(/[\u007f-\uffff]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));

  const finishRes = await fetch('https://content.dropboxapi.com/2/files/upload_session/finish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': finishArgs, 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(lastChunk).buffer,
    signal: AbortSignal.timeout(120000),
  });
  const finishData = await finishRes.json();
  if (!finishRes.ok) throw new Error(finishData.error_summary || 'Dropbox rechazó finalizar la subida.');

  return {
    success: true,
    path: finishData.path_display,
    filename: finishData.name,
    targetDir: destination,
    sizeBytes: finishData.size,
    modifiedDate: finishData.server_modified,
  };
}
export async function listDropboxFoldersCloud(folderPath = '', tokenOverride?: string) {
  const token = await getDropboxAccessToken(tokenOverride);
  const path = folderPath && folderPath !== '/' ? (folderPath.startsWith('/') ? folderPath : `/${folderPath}`) : '';
  const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      recursive: false,
      include_media_info: false,
      include_deleted: false,
      include_has_explicit_shared_members: false,
      include_mounted_folders: true,
      limit: 100,
    }),
    signal: AbortSignal.timeout(20000),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_summary || 'No se pudieron listar las carpetas de Dropbox.');
  }

  const entries: any[] = data.entries || [];
  const folders = entries
    .filter((e) => e['.tag'] === 'folder')
    .map((e) => ({
      name: e.name,
      path: e.path_display || e.path_lower,
      id: e.id,
    }));

  return {
    path,
    folders,
    hasMore: data.has_more,
    cursor: data.cursor,
  };
}

export function cloudFolder(domain: string | undefined, target: string | undefined, localRoot: string, root="proyecto", category="") {
  if (domain) return drxFolder(domain,root,category);
  if (!target) return '/DRX';
  const normalized = target.replace(/\\/g, '/');
  const localBase = localRoot.replace(/\\/g, '/').replace(/\/$/, '');
  if (normalized.toLowerCase().startsWith(localBase.toLowerCase() + '/')) return normalized.slice(localBase.length);
  if (normalized.startsWith('/') && !normalized.includes('..')) return normalized;
  throw new Error('La carpeta debe estar dentro de Dropbox.');
}

export async function getDropboxFileContent(filePath: string, tokenOverride?: string) {
  const token = await getDropboxAccessToken(tokenOverride);
  let cleanPath = filePath.replace(/\\/g, '/').trim();
  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;

  const arg = JSON.stringify({ path: cleanPath }).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  
  // Si es imagen, intentamos pedir thumbnail para rapidez, o descarga directa
  const isImg = /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(cleanPath);
  const endpoint = isImg
    ? 'https://content.dropboxapi.com/2/files/get_thumbnail_v2'
    : 'https://content.dropboxapi.com/2/files/download';

  const bodyArg = isImg
    ? JSON.stringify({ resource: { '.tag': 'path', path: cleanPath }, format: 'jpeg', size: 'w640h480', mode: 'strict' }).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
    : arg;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': bodyArg,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    // Si falló thumbnail, intentar descarga directa
    if (isImg) {
      const fallbackRes = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Dropbox-API-Arg': arg,
        },
        signal: AbortSignal.timeout(30000),
      });
      if (fallbackRes.ok) {
        const buffer = Buffer.from(await fallbackRes.arrayBuffer());
        const contentType = fallbackRes.headers.get('content-type') || 'image/jpeg';
        return { buffer, contentType };
      }
    }
    const errText = await response.text();
    throw new Error(`Error descargando de Dropbox (${response.status}): ${errText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || (isImg ? 'image/jpeg' : 'application/octet-stream');
  return { buffer, contentType };
}
