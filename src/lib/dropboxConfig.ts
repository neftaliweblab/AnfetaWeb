export const DEFAULT_DROPBOX_APP_KEY = '98zsk2p74wgempw';

/**
 * Genera la URL de autorización OAuth 2.0 de Dropbox.
 * Utiliza el flujo de Authorization Code offline para obtener un refresh token permanente.
 */
export function getDropboxAuthorizeUrl(appKey: string = DEFAULT_DROPBOX_APP_KEY, codeChallenge?: string): string {
  const cleanAppKey = (appKey || DEFAULT_DROPBOX_APP_KEY).trim();
  const params = new URLSearchParams({
    client_id: cleanAppKey,
    response_type: 'code',
    token_access_type: 'offline',
  });
  if (codeChallenge) { params.set('code_challenge', codeChallenge); params.set('code_challenge_method', 'S256'); }
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

export interface DropboxOAuthAccountInfo {
  account: string;
  email?: string;
  token?: string;
  hasRefreshToken?: boolean;
}

/** Each modal session gets a fresh verifier; never store it in settings or logs. */
export async function createDropboxPkceAuthorization() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64url = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const verifier = base64url(bytes);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return {verifier, url: getDropboxAuthorizeUrl(DEFAULT_DROPBOX_APP_KEY, challenge)};
}
