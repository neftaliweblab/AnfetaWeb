const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
const transpile=p=>ts.transpileModule(fs.readFileSync(__dirname+'/../'+p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const agenda={},input={},route={},calls=[];let denied=false,rpcError=null;
vm.runInNewContext(transpile('src/lib/reminderAgenda.ts'),{exports:agenda,Date,Error});
vm.runInNewContext(transpile('src/lib/reminderInput.ts'),{exports:input,require:()=>agenda});
const mocks={'@/lib/reminderAgenda':agenda,'@/lib/reminderInput':input,'next/server':{NextResponse:{json:(data,options={})=>({data,status:options.status||200})}},'@/services/serverAuth':{requireActor:async()=>{if(denied)throw Error('Inicia sesión')},assertSameOrigin:()=>{}},'@/services/supabaseServer':{supabaseConfigured:()=>true,supabaseIdentity:async()=>({id:'verified-actor'}),supabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{id:'saved'},error:rpcError}}})}};
vm.runInNewContext(transpile('src/app/api/reminders/route.ts'),{exports:route,require:n=>mocks[n],URL,Date,Error});
const body={action:'create',title:'Prueba',date:'2026-10-07',time:'12:30',priority:'high',recurrence:'monthly',actor:'spoof'};
const post=b=>route.POST({json:async()=>b});
(async()=>{
 let r=await post(body);assert.equal(r.status,200);assert.equal(calls.at(-1).name,'edit_reminder');assert.equal(calls.at(-1).args.p_actor,'verified-actor');assert.equal(calls.at(-1).args.p_recurrence,'monthly');
 const count=calls.length;for(const patch of [{date:'2026-02-30'},{recurrence:'yearly'},{time:'25:00'},{title:' '},{action:'edit',id:'a',revision:0}]){r=await post({...body,...patch});assert.equal(r.status,400);}assert.equal(calls.length,count);
 r=await post({...body,recurrence:'none'});assert.equal(r.status,200);assert.equal(calls.at(-1).name,'change_reminder');
 r=await post({...body,action:'edit',id:'id',revision:2});assert.equal(r.status,200);assert.equal(calls.at(-1).args.p_revision,2);
 rpcError={code:'PGRST202',message:'missing function'};r=await post(body);assert.match(r.data.error,/RECORDATORIOS_REPETICION.sql/);
 rpcError={message:'revision_conflict'};r=await post({...body,action:'edit',id:'id',revision:2});assert.match(r.data.error,/otro dispositivo/);
 denied=true;r=await post(body);assert.equal(r.status,401);
 console.log('OK API edición/repetición: fechas reales, validación, identidad del servidor, ruta compatible, conflicto y SQL faltante visible.');
})().catch(e=>{console.error(e);process.exitCode=1});
