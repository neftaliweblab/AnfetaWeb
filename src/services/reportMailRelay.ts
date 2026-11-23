import {createHash,randomUUID} from 'node:crypto';
import {getSettings} from './serverSettings';
import {buildDailyReport,dailyReportDay,dailyReportHtml} from './ftfDailyReport';
import {buildAndSendWeeklyFtfReport} from './ftfWeeklyReport';
import {buildWeeklyFtfEmailHtml,parseRecipients} from './ftfScoreDelivery';
import {ftfWeekStart} from './ftfDashboard';
import {mexicoDate} from './calendarPresentation';
import {notionSourceKey} from './notionSnapshotCache';
import {reportPublicUrl} from '@/lib/reportPublicUrl';
import {supabaseAdmin,supabaseConfigured} from './supabaseServer';
async function rpc(name:string,args:any){const r=await supabaseAdmin().rpc(name,args);if(r.error||(name==='finish_daily_report'&&r.data!==true))throw Error('No se confirmó el registro del correo.');return r.data;}
export async function prepareReportMail(actor:string,input:any,now=new Date()){
 if(!['ftf-report','ftf-weekly'].includes(input.job))throw Error('Reporte inválido.');
 const day=typeof input.date==='string'?input.date:mexicoDate(now),dryRun=input.dryRun===true;
 const skipped=dailyReportDay(day,now,dryRun);if(skipped)return {success:true,skipped,date:day};
 const raw:string=typeof input.to==='string'?input.to:'';if(raw.length>2000)throw Error('Demasiados destinatarios.');
 const to=[...new Set(parseRecipients(raw).map(s=>s.toLowerCase()))].sort();
 if(!dryRun&&(!to.length||to.length>10||to.length!==new Set(raw.split(/[,;]+/).map(s=>s.trim().toLowerCase()).filter(Boolean)).size))throw Error('Configura destinatarios válidos para el reporte.');
 if(!supabaseConfigured())throw Error('El historial de correo requiere Supabase.');
 const settings=getSettings(),token=randomUUID();
 const key=createHash('sha256').update(JSON.stringify(input.job==='ftf-report'?['ftf-daily-v1',notionSourceKey(settings),day,to]:['ftf-weekly-gmail-relay-v1',notionSourceKey(settings),ftfWeekStart(day),to])).digest('hex');
 if(!dryRun){const claim=await rpc('claim_daily_report',{p_key:key,p_date:day,p_to:to,p_token:token});if(claim.state!=='claimed')return {success:claim.state==='sent',date:day,state:claim.state,skipped:claim.state};}
 try{
  let subject:string,html:string,snapshot:any,people:number;
  if(input.job==='ftf-report'){
   const report=await buildDailyReport(settings,actor,day,now);subject='Reporte diario ANFETA · '+day;html=dailyReportHtml(report,day);snapshot=report;people=report.people.length;
  }else{
   const result=await buildAndSendWeeklyFtfReport({actor,targetDate:day,now,dryRun:true,forceCutoffComplete:true});
   subject=`Reporte semanal ANFETA · ${result.weekStart} al ${result.weekEnd}`;
   html=buildWeeklyFtfEmailHtml({weekStart:result.weekStart,weekEnd:result.weekEnd,weekDates:result.workDates,matrix:result.matrix,generatedAt:now.toISOString(),reportUrl:reportPublicUrl()+'/?ftf=week'});snapshot={week:result.week,matrix:result.matrix};people=result.matrix.length;
  }
  if(dryRun)return {success:true,dryRun:true,date:day,people};
  await rpc('finish_daily_report',{p_key:key,p_token:token,p_state:'sending',p_payload:{subject,html,report:snapshot,transport:'gmail-github'}});
  return {success:true,date:day,people,delivery:{key,token,to,subject,html}};
 }catch(error){if(!dryRun)await rpc('finish_daily_report',{p_key:key,p_token:token,p_state:'failed',p_payload:{reason:'No se pudo preparar el correo; no se intentó enviarlo.'}}).catch(()=>{});throw error;}
}
export async function finishReportMail(input:any){
 if(!/^[a-f0-9]{64}$/.test(input.key||'')||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.token||'')||!['sent','failed','uncertain'].includes(input.state))throw Error('Confirmación de correo inválida.');
 const result=await supabaseAdmin().from('daily_report_deliveries').select('state,token').eq('key',input.key).eq('token',input.token).maybeSingle();
 if(result.error||!result.data)throw Error('La confirmación no corresponde a este envío.');
 if(result.data.state===input.state)return {success:true,state:input.state,alreadyRecorded:true};
 if(result.data.state!=='sending')throw Error('El envío ya está cerrado; no se modificó su historial.');
 const emailId=typeof input.emailId==='string'?input.emailId.slice(0,250):undefined;
 await rpc('finish_daily_report',{p_key:input.key,p_token:input.token,p_state:input.state,p_payload:{provider:'gmail-github',emailId,reason:input.state==='sent'?null:input.state==='failed'?'El envío fue rechazado antes de ser aceptado.':'No se confirmó la entrega; revisa Gmail antes de repetir.'}});
 return {success:true,state:input.state};
}
