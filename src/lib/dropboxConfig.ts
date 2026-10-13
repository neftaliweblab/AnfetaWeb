export const DEFAULT_DROPBOX_APP_KEY = '98zsk2p74wgempw';

/**
 * Genera la URL de autorización OAuth 2.0 de Dropbox.
 * Utiliza el flujo de Authorization Code offline para obtener un refresh token permanente.
 */
export function getDropboxAuthorizeUrl(appKey: string = DEFAULT_DROPBOX_APP_KEY): string {
  const cleanAppKey = (appKey || DEFAULT_DROPBOX_APP_KEY).trim();
  const params = new URLSearchParams({
    client_id: cleanAppKey,
    response_type: 'code',
    token_access_type: 'offline',
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

export interface DropboxOAuthAccountInfo {
  account: string;
  email?: string;
  token?: string;
  hasRefreshToken?: boolean;
}
