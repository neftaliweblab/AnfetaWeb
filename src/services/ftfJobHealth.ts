import {supabaseAdmin,supabaseConfigured} from './supabaseServer';
import {notionSourceKey} from './notionSnapshotCache';
import {isDirection} from './activityPermissions';
export async function ftfJobHealth(settings:any,day:string){
 const config={secretConfigured:(process.env.CRON_SECRET||'').length>=32,actorConfigured:isDirection(process.env.ANFETA_ROBOT_PERSON||'')};
 if(!supabaseConfigured())return {...config,state:'unavailable',jobs:[]};
 try{
  const source=notionSourceKey(settings);
  const result=await supabaseAdmin().from('automation_jobs').select('source_key,status,updated_at,report').in('source_key',[source+':ftf-reset-v1',source+':ftf-rollover-v1']).eq('day',day);
  if(result.error)throw result.error;
  const jobs=(result.data||[]).map((r:any)=>({kind:r.source_key.endsWith(':ftf-reset-v1')?'reset':'rollover',status:r.status,updatedAt:r.updated_at,reset:r.report?.reset||0,moved:r.report?.moved||0,failed:r.report?.failed||0,remaining:r.report?.remaining||0}));
  return {...config,state:jobs.length?'recorded':'missing',jobs};
 }catch{return {...config,state:'unavailable',jobs:[]};}
}
