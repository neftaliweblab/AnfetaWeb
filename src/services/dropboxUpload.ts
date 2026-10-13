import {drxFolder} from '@/lib/drxUploadPlan';
import {getSettings} from '@/services/serverSettings';
import {DEFAULT_DROPBOX_APP_KEY, getDropboxAuthorizeUrl} from '@/lib/dropboxConfig';
export {DEFAULT_DROPBOX_APP_KEY, getDropboxAuthorizeUrl};

let cachedToken: { token: string; expiresAt: number } | null = null;

export function clearCachedDropboxToken() {
  cachedToken = null;
}

export interface DropboxExchangeResult {
  accessToken: string;
  refreshToken?: string;
  accountId?: string;
  uid?: string;
  displayName?: string;
  email?: string;
}

export async function exchangeDropboxCode(
  code: string,
  appKey = DEFAULT_DROPBOX_APP_KEY,
  appSecret?: string
): Promise<DropboxExchangeResult> {
  const cleanCode = code.trim();
  const cleanAppKey = (appKey || DEFAULT_DROPBOX_APP_KEY).trim();
  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code: cleanCode,
    client_id: cleanAppKey,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const secret = (appSecret || process.env.DROPBOX_APP_SECRET || '').trim();
  if (secret) {
    const basic = Buffer.from(`${cleanAppKey}:${secret}`).toString('base64');
    headers['Authorization'] = `Basic ${basic}`;
  }

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers,
    body: bodyParams,
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    const errDetail = data?.error_description || data?.error || (data ? JSON.stringify(data) : `HTTP ${res.status}`);
    console.error('Dropbox OAuth exchange error:', errDetail);
    throw new Error(errDetail);
  }

  const expiresInMs = (data.expires_in || 14400) * 1000;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInMs,
  };

  let displayName = '';
  let email = '';
  try {
    const accountRes = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (accountRes.ok) {
      const accountData = await accountRes.json().catch(() => null);
      if (accountData) {
        displayName = accountData.name?.display_name || accountData.name?.familiar_name || '';
        email = accountData.email || '';
      }
    }
  } catch (accErr) {
    console.warn('No se pudo obtener información de cuenta Dropbox:', accErr);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    accountId: data.account_id,
    uid: data.uid,
    displayName: displayName || email || 'Cuenta de Dropbox',
    email,
  };
}

export async function refreshDropboxAccessToken(
  refreshToken: string,
  appKey = DEFAULT_DROPBOX_APP_KEY,
  appSecret?: string
): Promise<string> {
  const cleanRefresh = refreshToken.trim();
  const cleanAppKey = (appKey || DEFAULT_DROPBOX_APP_KEY).trim();
  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: cleanRefresh,
    client_id: cleanAppKey,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (appSecret && appSecret.trim()) {
    const basic = Buffer.from(`${cleanAppKey}:${appSecret.trim()}`).toString('base64');
    headers['Authorization'] = `Basic ${basic}`;
  }

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers,
    body: bodyParams,
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json().catch(() => null);
  if (res.ok && data?.access_token) {
    const expiresInMs = (data.expires_in || 14400) * 1000;
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + expiresInMs,
    };
    return data.access_token;
  }

  const errDetail = data?.error_description || data?.error || (data ? JSON.stringify(data) : `HTTP ${res.status}`);
  console.error('Dropbox OAuth refresh error:', errDetail);
  throw new Error(`Dropbox OAuth error: ${errDetail}`);
}

export async function getDropboxAccessToken(tokenOverride?: string, forceRefresh = false): Promise<string> {
  const cleanOverride = (tokenOverride || '').trim();

  // 1. Si tokenOverride es un refresh token (no empieza con "sl." y longitud >= 40)
  if (cleanOverride && !cleanOverride.startsWith('sl.') && cleanOverride.length >= 40) {
    if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
      return cachedToken.token;
    }
    try {
      return await refreshDropboxAccessToken(
        cleanOverride,
        process.env.DROPBOX_APP_KEY || DEFAULT_DROPBOX_APP_KEY,
        process.env.DROPBOX_APP_SECRET
      );
    } catch (e) {
      console.warn('Fallo renovación con tokenOverride:', e);
    }
  }

  // 2. Si tokenOverride es un access token (ej. empieza con "sl.") y no estamos forzando renovación
  if (cleanOverride && !forceRefresh) {
    return cleanOverride;
  }

  // 3. Revisar token cacheado en memoria si no se forzó renovación
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  // 4. Intentar auto-renovar usando DROPBOX_REFRESH_TOKEN de entorno o ajustes
  const envRefreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const envAppKey = process.env.DROPBOX_APP_KEY || DEFAULT_DROPBOX_APP_KEY;
  const envAppSecret = process.env.DROPBOX_APP_SECRET;

  const candidateRefreshToken =
    (envRefreshToken && envRefreshToken.trim()) ||
    (process.env.DROPBOX_ACCESS_TOKEN && !process.env.DROPBOX_ACCESS_TOKEN.startsWith('sl.') && process.env.DROPBOX_ACCESS_TOKEN.length >= 40 ? process.env.DROPBOX_ACCESS_TOKEN.trim() : undefined) ||
    (getSettings().dropboxToken && !getSettings().dropboxToken.startsWith('sl.') && getSettings().dropboxToken.length >= 40 ? getSettings().dropboxToken.trim() : undefined);

  if (candidateRefreshToken) {
    try {
      return await refreshDropboxAccessToken(candidateRefreshToken, envAppKey, envAppSecret);
    } catch (e: any) {
      console.error('Error auto-renovando Dropbox access token con refresh token:', e);
      if (e?.message?.includes('Dropbox OAuth error') && !process.env.DROPBOX_ACCESS_TOKEN) {
        throw e;
      }
    }
  }

  // 5. Fallback a DROPBOX_ACCESS_TOKEN estático en env o ajustes
  const fallback = (process.env.DROPBOX_ACCESS_TOKEN || getSettings().dropboxToken || '').trim();
  if (fallback) {
    return fallback;
  }

  throw new Error('Dropbox no está vinculado. Haz clic en "Conectar con Dropbox" para autorizar tu cuenta.');
}

export async function uploadDropboxCloud(filename: string, bytes: Buffer, folder: string, tokenOverride?: string) {
  let token = await getDropboxAccessToken(tokenOverride);
  const safeName = filename.replace(/.*[\\/]/, '').replace(/[\x00-\x1f]/g, '').trim();
  if (!safeName || safeName === '.' || safeName === '..') throw new Error('Nombre de archivo inválido.');
  const segments = folder.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.some(part => part === '..' || part === '.')) throw new Error('Ruta de Dropbox inválida.');
  let destination = '';
  for (const segment of segments) {
    destination += '/' + segment;
    let response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: destination, autorename: false }), signal: AbortSignal.timeout(30000) });
    if (response.status === 401) {
      try {
        token = await getDropboxAccessToken(undefined, true);
        response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: destination, autorename: false }), signal: AbortSignal.timeout(30000) });
      } catch {}
    }
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
    let response = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': args, 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(bytes).buffer, signal: AbortSignal.timeout(60000) });
    if (response.status === 401) {
      try {
        token = await getDropboxAccessToken(undefined, true);
        response = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': args, 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(bytes).buffer, signal: AbortSignal.timeout(60000) });
      } catch {}
    }
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
  let token = await getDropboxAccessToken(tokenOverride);
  const path = folderPath && folderPath !== '/' ? (folderPath.startsWith('/') ? folderPath : `/${folderPath}`) : '';
  const makeBody = () => JSON.stringify({
    path,
    recursive: false,
    include_media_info: false,
    include_deleted: false,
    include_has_explicit_shared_members: false,
    include_mounted_folders: true,
    limit: 100,
  });

  let response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: makeBody(),
    signal: AbortSignal.timeout(20000),
  });

  if (response.status === 401) {
    try {
      token = await getDropboxAccessToken(undefined, true);
      response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: makeBody(),
        signal: AbortSignal.timeout(20000),
      });
    } catch {}
  }

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

export function getDropboxFileContent(filePath:string,tokenOverride:string|undefined,stream:true):Promise<{body:ReadableStream<Uint8Array>;contentType:string}>;
export function getDropboxFileContent(filePath:string,tokenOverride?:string):Promise<{buffer:Buffer;contentType:string}>;
export async function getDropboxFileContent(filePath: string, tokenOverride?: string, stream=false): Promise<any> {
  let token = await getDropboxAccessToken(tokenOverride);
  let cleanPath = filePath.replace(/\\/g, '/').trim();

  // Si viene una ruta local completa de Windows (ej. C:/Users/nanoc/Dropbox/DRX/...), extraer ruta en la nube
  const dbxMatch = cleanPath.match(/.*\/Dropbox(\/.*)$/i);
  if (dbxMatch) {
    cleanPath = dbxMatch[1];
  } else if (/^[a-zA-Z]:\//i.test(cleanPath)) {
    cleanPath = cleanPath.replace(/^[a-zA-Z]:/i, '');
  }

  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;

  const candidatePaths = [
    cleanPath,
    cleanPath.replace(/\.carpeta\b/gi, '.proyecto'),
    cleanPath.replace(/\.proyecto\b/gi, '.Carpeta'),
    cleanPath.replace(/\.carpeta\b/gi, '.programa'),
    cleanPath.replace(/\.carpeta\b/gi, '.webs'),
  ];
  // Eliminar duplicados manteniendo orden
  const uniquePaths = Array.from(new Set(candidatePaths));

  const tryFetchPath = async (targetPath: string) => {
    const isImg = /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(targetPath);
    const endpoint = isImg
      ? 'https://content.dropboxapi.com/2/files/get_thumbnail_v2'
      : 'https://content.dropboxapi.com/2/files/download';

    const bodyArg = isImg
      ? JSON.stringify({ resource: { '.tag': 'path', path: targetPath }, format: 'jpeg', size: 'w640h480', mode: 'strict' }).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
      : JSON.stringify({ path: targetPath }).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': bodyArg,
      },
      signal: AbortSignal.timeout(25000),
    });

    if (response.status === 401) {
      try {
        token = await getDropboxAccessToken(undefined, true);
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Dropbox-API-Arg': bodyArg,
          },
          signal: AbortSignal.timeout(25000),
        });
      } catch {}
    }

    if (!response.ok && isImg) {
      // Si falló el thumbnail por formato o tamaño, intentar descarga directa
      const dlArg = JSON.stringify({ path: targetPath }).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
      let dlRes = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': dlArg },
        signal: AbortSignal.timeout(25000),
      });

      if (dlRes.status === 401) {
        try {
          token = await getDropboxAccessToken(undefined, true);
          dlRes = await fetch('https://content.dropboxapi.com/2/files/download', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': dlArg },
            signal: AbortSignal.timeout(25000),
          });
        } catch {}
      }

      if (dlRes.ok) {
        if(stream&&dlRes.body)return {body:dlRes.body,contentType:dlRes.headers.get('content-type')||'image/jpeg'};
        const buffer = Buffer.from(await dlRes.arrayBuffer());
        const contentType = dlRes.headers.get('content-type') || 'image/jpeg';
        return { buffer, contentType };
      }
    }

    if (response.ok) {
      if(stream&&response.body)return {body:response.body,contentType:response.headers.get('content-type')||(isImg?'image/jpeg':'application/octet-stream')};
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || (isImg ? 'image/jpeg' : 'application/octet-stream');
      return { buffer, contentType };
    }

    return null;
  };

  let lastError = '';
  for (const candidate of uniquePaths) {
    try {
      const result = await tryFetchPath(candidate);
      if (result) return result;
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  throw new Error(`No se pudo obtener la vista previa desde Dropbox API (${cleanPath}): ${lastError || 'Archivo no encontrado'}`);
}
