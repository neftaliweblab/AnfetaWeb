import {notionRequest,mutateActivity} from './notionMutations';
import {assignedPerson} from './notionCalendar';
import {canEditActivity,isReviewer} from './activityPermissions';
import {isFtfActivity} from './progressKpis';
import {mexicoDate,mexicoMinutes} from './calendarPresentation';
import {supabaseAdmin,supabaseConfigured} from './supabaseServer';
import {notionSourceKey} from './notionSnapshotCache';
import {normalizePerson,PERSON_ALIASES} from './identityNormalizer';
import {recordPageEvent,parseNotionPageProperties,calendarActivityFromPage} from './notionEventSync';

export function ftfRolloverSchedule(page:any,actor:string,day:string){
  const title=Object.values(page.properties||{}).filter((p:any)=>p.type==='title').flatMap((p:any)=>p.title||[]).map((t:any)=>t.plain_text||t.text?.content||'').join('');
  if(page.archived||page.in_trash||!isFtfActivity(title)||!canEditActivity(actor,{title,person:assignedPerson(page),isLocked:Object.entries(page.properties||{}).some(([n,p]:any)=>/lock|bloquead/i.test(n)&&p.checkbox)}))return null;
  const field:any=Object.entries(page.properties||{}).find(([n,p]:any)=>/^fecha por hacer$/i.test(n.trim())&&p.type==='date')?.[1];
  const date=field?.date;
  if(!date?.start||(date.start.length===10?date.start:mexicoDate(date.start))>=day)return null;
  const minute=date.start.length===10?1080:mexicoMinutes(date.start);
  const duration=date.end?(Date.parse(date.end)-Date.parse(date.start))/60000:60;
  if(!Number.isFinite(duration)||duration<=0||minute<480||minute+duration>1320||minute%5||duration%5)return null;
  const at=(m:number)=>day+'T'+String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+':00-06:00';
  return {start:at(minute),end:at(minute+duration),expectedStart:date.start,expectedEnd:date.end,expectedEditedAt:page.last_edited_time,ftfRollover:true};
}

export async function rolloverDailyFtf(settings:any,actor:string,day:string,now=new Date()){
  if(day!==mexicoDate(now.toISOString())||mexicoMinutes(now.toISOString())<300)return {moved:0,remaining:0,failed:0,skipped:'before_0500_or_other_day'};
  if(!supabaseConfigured())throw Error('El traslado FTF requiere Supabase.');
  const admin=supabaseAdmin(),source=notionSourceKey(settings),tag=PERSON_ALIASES[normalizePerson(actor)]?.[0];
  if(!tag)throw Error('Persona no válida para trasladar FTF.');
  const claim=await admin.rpc('claim_automation_job',{p_source:source+':ftf-rollover-v1',p_day:day,p_actor:tag,p_scope_all:isReviewer(actor),p_force:false});
  if(claim.error)throw Error('No se pudo coordinar el traslado FTF.');
  if(['completed','busy'].includes(claim.data?.state))return {moved:0,remaining:0,failed:0,skipped:claim.data.state};
  if(!claim.data?.token)throw Error('No se confirmó el permiso de traslado FTF.');
  const report={moved:0,remaining:0,failed:0,errors:[] as string[]};
  try{
    const id=process.env.NOTION_CALENDAR_DATA_SOURCE_ID||settings.notionDataSourceId||'2eeabd7d-91b7-8193-a131-000b08cd54e2';
    const candidates:any[]=[];let cursor:string|undefined;
    do{
      const batch=await notionRequest(settings,'data_sources/'+id+'/query','POST',{page_size:100,filter:{and:[{property:'Fecha POR Hacer',date:{before:day+'T00:00:00-06:00'}},{or:[{property:'title',title:{contains:'FTF'}},{property:'title',title:{contains:'ccale'}}]}]},...(cursor?{start_cursor:cursor}:{})});
      candidates.push(...(batch.results||[]).filter((p:any)=>ftfRolloverSchedule(p,actor,day)));
      if(batch.has_more&&(!batch.next_cursor||batch.next_cursor===cursor))throw Error('Consulta de tarjetas FTF incompleta.');
      cursor=batch.has_more?batch.next_cursor:undefined;
    }while(cursor);
    report.remaining=Math.max(0,candidates.length-10);
    for(const page of candidates.slice(0,10))try{
      const updates=ftfRolloverSchedule(page,actor,day)!;
      const saved=await mutateActivity(settings,actor,page.id,updates),parsed=parseNotionPageProperties(saved),activity=calendarActivityFromPage(saved,id);
      report.moved++;
      await recordPageEvent({sourceKey:source,pageId:page.id,state:'active',eventType:'polled_state',serverModified:saved.last_edited_time,properties:{name:parsed.title,assignedPerson:parsed.person,updateStatus:parsed.status,scheduledDate:parsed.dateStart,scheduledEnd:activity?.end,calendarActivity:activity,ftfVerified:false}});
    }catch(e){report.failed++;report.errors.push(page.id+': '+(e instanceof Error?e.message:'No se confirmó el traslado.'));}
    const finish=await admin.rpc('finish_automation_job',{p_token:claim.data.token,p_report:report,p_error:null});
    if(finish.error||!finish.data)throw Error('No se confirmó el registro del traslado FTF.');
    return report;
  }catch(e){await admin.rpc('finish_automation_job',{p_token:claim.data.token,p_report:report,p_error:e instanceof Error?e.message:'Falló traslado FTF.'});throw e;}
}
