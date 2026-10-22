import {ftfField} from './ftfVerification';
import {notionRequest,mutateActivity} from './notionMutations';
import {assignedPerson,calendarStatusField} from './notionCalendar';
import {canEditActivity,isReviewer} from './activityPermissions';
import {workflowState} from './activityWorkflow';
import {mexicoDate,mexicoMinutes} from './calendarPresentation';
import {supabaseAdmin,supabaseConfigured} from './supabaseServer';
import {notionSourceKey} from './notionSnapshotCache';
import {operationKey,durableStep} from './reliableOperations';
import {normalizePerson,PERSON_ALIASES} from './identityNormalizer';
import {recordPageEvent,parseNotionPageProperties} from './notionEventSync';

export function ftfResetCandidate(page:any,actor:string,day:string){
  const field=ftfField(page);if(!field?.[1].checkbox||page.archived||page.in_trash)return false;
  const title=Object.values(page.properties||{}).filter((p:any)=>p.type==='title').flatMap((p:any)=>p.title||[]).map((t:any)=>t.plain_text||t.text?.content||'').join('');
  const status=calendarStatusField(page)?.[1],state=workflowState(status?.[status.type]?.name||'',title);
  if(!['pending','suspended','review'].includes(state))return false;
  const locked=Object.entries(page.properties||{}).some(([n,p]:any)=>/lock|bloquead/i.test(n)&&p.checkbox);
  if(!canEditActivity(actor,{title,person:assignedPerson(page),isLocked:locked}))return false;
  const date:any=Object.entries(page.properties||{}).find(([n,p]:any)=>/^fecha por hacer$/i.test(n.trim())&&p.type==='date')?.[1];
  const scheduled=date?.date?.start;
  if(!scheduled||(scheduled.length===10?scheduled:mexicoDate(scheduled))>day)return false;
  // A delayed first run must not erase a verification possibly made this morning.
  const cutoff=Date.parse(day+'T05:00:00-06:00');
  return Number.isFinite(Date.parse(page.last_edited_time))&&Date.parse(page.last_edited_time)<cutoff;
}

export async function resetDailyFtf(settings:any,actor:string,day:string,now=new Date()){
  if(day!==mexicoDate(now.toISOString())||mexicoMinutes(now.toISOString())<300)return {reset:0,remaining:0,failed:0,skipped:'before_0500_or_other_day'};
  if(!supabaseConfigured())throw Error('El reinicio FTF requiere Supabase y las migraciones 6 y 14 para evitar reinicios duplicados.');
  const admin=supabaseAdmin(),source=notionSourceKey(settings),tag=PERSON_ALIASES[normalizePerson(actor)]?.[0];
  if(!tag)throw Error('Persona no válida para reiniciar FTF.');
  const claim=await admin.rpc('claim_automation_job',{p_source:source+':ftf-reset-v1',p_day:day,p_actor:tag,p_scope_all:isReviewer(actor),p_force:false});
  if(claim.error)throw Error('No se pudo coordinar el reinicio FTF en Supabase. Revisa la migración 6.');
  if(claim.data?.state==='completed'||claim.data?.state==='busy')return {reset:0,remaining:0,failed:0,skipped:claim.data.state};
  if(!claim.data?.token)throw Error('Supabase no confirmó el permiso de ejecución FTF.');
  let report={reset:0,remaining:0,failed:0,errors:[] as string[]};
  try{
    const sourceId=process.env.NOTION_CALENDAR_DATA_SOURCE_ID||settings.notionDataSourceId||'2eeabd7d-91b7-8193-a131-000b08cd54e2';
    const schema=await notionRequest(settings,'data_sources/'+sourceId),field=ftfField(schema);
    if(!field)throw Error('No se encontró la casilla de verificación FTF en la fuente de Revisiones.');
    const candidates:any[]=[];let cursor:string|undefined;
    do{
      const batch=await notionRequest(settings,'data_sources/'+sourceId+'/query','POST',{page_size:100,filter:{property:field[0],checkbox:{equals:true}},...(cursor?{start_cursor:cursor}:{})});
      candidates.push(...(batch.results||[]).filter((page:any)=>ftfResetCandidate(page,actor,day)));
      if(batch.has_more&&(!batch.next_cursor||batch.next_cursor===cursor))throw Error('No se pudo completar la consulta FTF.');
      cursor=batch.has_more?batch.next_cursor:undefined;
    }while(cursor);
    const batch=candidates.slice(0,10);report.remaining=Math.max(0,candidates.length-batch.length);
    for(const page of batch)try{
      const result=await durableStep(operationKey('ftf-reset-v1',source,day,page.id.replace(/-/g,'')),async()=>{
        const fresh=await notionRequest(settings,'pages/'+page.id);
        if(!ftfResetCandidate(fresh,actor,day))return {reset:false};
        const saved=await mutateActivity(settings,actor,page.id,{ftfVerified:false,expectedFtfVerified:true,expectedEditedAt:fresh.last_edited_time,ftfDailyReset:true});
        const parsed=parseNotionPageProperties(saved);
        await recordPageEvent({sourceKey:source,pageId:page.id,state:'active',eventType:'polled_state',serverModified:saved.last_edited_time,properties:{name:parsed.title,assignedPerson:parsed.person,updateStatus:parsed.status,scheduledDate:parsed.dateStart,ftfVerified:false}});
        return {reset:true};
      });
      if(result.reset)report.reset++;
    }catch(e){report.failed++;report.errors.push(page.id+': '+(e instanceof Error?e.message:'No se confirmó el reinicio.'));}
    const finished=await admin.rpc('finish_automation_job',{p_token:claim.data.token,p_report:report,p_error:null});
    if(finished.error||!finished.data)throw Error('No se confirmó el registro del reinicio FTF; revisa el historial antes de repetir.');
    return report;
  }catch(e){await admin.rpc('finish_automation_job',{p_token:claim.data.token,p_report:report,p_error:e instanceof Error?e.message:'No se completó el reinicio.'});throw e;}
}
