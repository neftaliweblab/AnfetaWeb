/** Read-only Notion audit. Default: monthly reports and representatives of other categories. */
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
const root=path.resolve(__dirname,'..');process.chdir(root);const resolve=Module._resolveFilename;
Module._resolveFilename=function(n,p,...r){if(n.startsWith('@/'))n=path.join(root,'src',n.slice(2));return resolve.call(this,n,p,...r)};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const settings=fs.existsSync('settings.json')?JSON.parse(fs.readFileSync('settings.json','utf8')):{};
settings.notionToken=process.env.NOTION_TOKEN||settings.notionToken;if(!settings.notionToken)throw Error('Configura NOTION_TOKEN o settings.json. No se imprime la credencial.');
const actualFetch=global.fetch;global.fetch=(url,options={})=>{if((options.method||'GET')!=='GET')throw Error('Auditoría de lectura: escritura bloqueada.');return actualFetch(url,options)};
const catalog=JSON.parse(fs.readFileSync('data/notion_template_phase1_catalog_v2.json','utf8')).Items;
const requested=process.argv.slice(2),selected=requested.includes('--all')?[...catalog]:requested.length?catalog.filter(x=>requested.includes(x.PageId)):catalog.filter(x=>/reporte.*mes|mes.*reporte/i.test(x.Title));
if(!requested.length)for(const tag of ['wwebs','aapli','pprog','mmaps']){const item=catalog.find(x=>x.Title.toLowerCase().includes(tag));if(item&&!selected.some(x=>x.PageId===item.PageId))selected.push(item);}
const {auditTemplateAccess}=require('../src/services/templateAccessAudit.ts');
(async()=>{const results=[];for(const item of selected){const report=await auditTemplateAccess({...settings,notionSignal:AbortSignal.timeout(60000)},item.PageId);results.push({title:item.Title,...report});console.log(JSON.stringify({title:item.Title,...report}));}console.log(JSON.stringify({readOnly:true,catalogTotal:catalog.length,audited:results.length,readable:results.filter(r=>r.readable).length,needsAttention:results.filter(r=>!r.readable).length}));})().catch(error=>{console.error(error.message);process.exitCode=1});
