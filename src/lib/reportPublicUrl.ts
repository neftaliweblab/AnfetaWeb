/** Public production origin for email links; never use a build/preview deployment URL. */
export function reportPublicUrl(env:Record<string,string|undefined>=process.env){
 for(const candidate of [env.ANFETA_PUBLIC_URL,env.NEXT_PUBLIC_APP_URL,env.APP_URL,env.RENDER_EXTERNAL_URL,env.VERCEL_PROJECT_PRODUCTION_URL]){
  if(!candidate?.trim())continue;
  try{const raw=candidate.trim(),url=new URL(raw.startsWith('http')?raw:'https://'+raw);
   if(url.protocol!=='https:'||url.username||url.password||url.port||['localhost','127.0.0.1','0.0.0.0','[::1]'].includes(url.hostname)||url.hostname.includes('-git-')||url.hostname.includes('.preview.'))continue;
   return url.origin;
  }catch{}
 }
 return 'https://anfeta-web-iota.vercel.app';
}
