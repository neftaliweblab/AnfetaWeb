/** Accept only the request origin or the explicitly configured Render production origin. */
export function allowedRequestOrigin(request:Request,env:Record<string,string|undefined>=process.env){
 const origin=request.headers.get('origin');
 if(!origin||origin===new URL(request.url).origin)return true;
 if(env.RENDER!=='true')return false;
 for(const base of [env.RENDER_EXTERNAL_URL,env.ANFETA_PUBLIC_URL]){
  if(!base)continue;
  try{const url=new URL(base);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&origin===url.origin)return true;}catch{}
 }
 return false;
}
