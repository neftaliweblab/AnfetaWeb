const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(n,p,...a){if(n.startsWith('@/'))n=path.join(root,'src',n.slice(2));return resolve.call(this,n,p,...a)};
for(const ext of ['.ts','.tsx']) require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
Module._load=function(n,p,...a){if(p?.filename.endsWith('dropboxUpload.ts')&&n==='@/services/serverSettings')return {getSettings:()=>({})};return load.call(this,n,p,...a)};
(async()=>{
const {createDropboxPkceAuthorization}=require(root+'/src/lib/dropboxConfig.ts');const flow=await createDropboxPkceAuthorization(),second=await createDropboxPkceAuthorization(),url=new URL(flow.url);
assert.match(flow.verifier,/^[A-Za-z0-9._~-]{43,128}$/);assert.notEqual(flow.verifier,second.verifier);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('code_challenge'),crypto.createHash('sha256').update(flow.verifier).digest('base64url'));assert.equal(url.searchParams.get('token_access_type'),'offline');assert.ok(!flow.url.includes(flow.verifier));
const {exchangeDropboxCode,refreshDropboxAccessToken}=require(root+'/src/services/dropboxUpload.ts');let calls=[];
global.fetch=async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>url.includes('get_current_account')?{name:{display_name:'Test'}}:{access_token:'test-only',refresh_token:'test-refresh',expires_in:3600}}};
await assert.rejects(exchangeDropboxCode('code',undefined,undefined,'short'));assert.equal(calls.length,0);
process.env.DROPBOX_APP_SECRET='server-secret-test-only';const result=await exchangeDropboxCode('code',undefined,undefined,flow.verifier);assert.equal(result.refreshToken,'test-refresh');assert.equal(calls[0].init.body.get('code_verifier'),flow.verifier);assert.ok(!calls[0].init.headers.Authorization);assert.ok(!calls[0].init.body.has('client_secret'));
calls=[];await refreshDropboxAccessToken('test-refresh');assert.equal(calls[0].init.body.get('grant_type'),'refresh_token');assert.ok(!calls[0].init.headers.Authorization);
calls=[];await exchangeDropboxCode('code',undefined,'test-secret');assert.ok(calls[0].init.headers.Authorization.startsWith('Basic '));assert.ok(!calls[0].init.body.has('code_verifier'));
console.log('OK Dropbox PKCE: random verifier, S256, offline flow, validation before network, no secret in PKCE exchange, public refresh and legacy compatibility. No real accounts linked.');
})().catch(e=>{console.error(e);process.exitCode=1});
