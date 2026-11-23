import {reportPublicUrl} from '@/lib/reportPublicUrl';
import {createHash,randomUUID} from 'node:crypto';
import {getSettings} from './serverSettings';
import {activeTeam} from './teamDirectory';
import {queryCalendarPages,knownReviewFlow,cachedReviewFlow,assignedPerson,calendarStatusField} from './notionCalendar';
import {hydrateWeeklyFtfActivities,extractCalendarPageForWeeklyReport,readWeeklyLocalJson} from './ftfWeeklyReport';
import {readFtfPresenceHistory} from './ftfPresenceHistory';
import {readUserState} from './userState';
import {readDailySnapshotMirrors} from './checklistPlanning';
import {normalizeActivity} from './dataNormalizers';
import {buildFtfDashboard,shiftFtfDate} from './ftfDashboard';
import {calendarDisplayTitle,mexicoDate,mexicoMinutes} from './calendarPresentation';
import {deliverHtmlEmail,parseRecipients} from './ftfScoreDelivery';
import {supabaseAdmin,supabaseConfigured} from './supabaseServer';
import {notionSourceKey} from './notionSnapshotCache';

export function dailyReportDay(date:string,now=new Date(),dryRun=false){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Fecha de reporte inválida.');
 const today=mexicoDate(now);
 if(date>today)throw Error('No se puede reportar un día futuro.');
 if([0,6].includes(new Date(date+'T12:00:00Z').getUTCDay()))return 'weekend';
 if(date===today&&mexicoMinutes(now.toISOString())<1110&&!dryRun)return 'before_cutoff';
 return null;
}
const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const clock=(s:unknown)=>s&&Number.isFinite(Date.parse(String(s)))?new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(String(s))):'Sin registro';
export function dailyReportHtml(report:any,date:string){
 const base=escape(reportPublicUrl());
 const rows=report.people.map((p:any)=>`<tr><td>${escape(p.name)}</td><td>${clock(p.firstSeen)}</td><td>${clock(p.presenceLastSeen)}</td><td>${escape(p.assignedHours)} h</td><td>${escape(p.workCompletedHours)} h</td><td>${escape(p.reviewHours)} h</td><td>${escape(p.inProgressHours)} h</td><td>${escape(p.verified)}/${escape(p.total)}</td><td>${clock(p.completedAt)}${p.completedAt&&p.timeKind!=='confirmed'?' (detectado)':''}</td></tr>`).join('');
 const details=report.people.map((p:any)=>`<h3>${escape(p.name)}</h3><p>Terminadas: ${p.completedActivities.length} · En revisión: ${p.reviewActivities.length} · Pendientes: ${p.inProgressActivities.length}</p><ul>${p.inProgressActivities.map((a:any)=>`<li>${escape(calendarDisplayTitle(a.title||a.shortTitle||'Actividad'))}${a.pageId&&/^[a-f0-9-]{32,36}$/i.test(a.pageId)?` — <a href="${base}/?activity=${a.pageId.replace(/-/g,'').toLowerCase()}">Abrir actividad</a>`:''}</li>`).join('')||'<li>Sin actividades pendientes registradas</li>'}</ul>`).join('');
 return `<html><body style="font-family:Arial,sans-serif;color:#172033"><h1>Reporte diario ANFETA · ${escape(date)}</h1><p>Corte: 18:30 · America/Mexico_City. Generado: ${escape(report.updatedAt)}.</p><p>Horas asignadas: ${escape(report.totalAssignedHours)}. Horas terminadas y en revisión: ${escape(report.totalCompletedHours)}.</p><table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse"><thead><tr><th>Usuario</th><th>Primera conexión</th><th>Última señal real</th><th>Asignadas</th><th>Terminadas</th><th>En revisión</th><th>Pendientes</th><th>FTF verificados</th><th>Cierre FTF</th></tr></thead><tbody>${rows}</tbody></table><p>La última señal de conexión no equivale a una salida confirmada. Sin registro significa que no hay evidencia disponible. En revisión se muestra separado de terminado.</p>${details}<p><a href="${base}/?ftf=week">Consultar bitácora en ANFETA</a></p></body></html>`;
}
export async function buildDailyReport(settings:any,actor:string,date:string,now=new Date()){
 const end=shiftFtfDate(date,1);
 const [pages,people,presence,state]=await Promise.all([queryCalendarPages(settings,date,end,false),activeTeam(),readFtfPresenceHistory(date,end),readUserState(settings,'John')]);
 const cachedFlat=Object.values(readWeeklyLocalJson<Record<string,any[]>>('notion_calendar_cache_v13.json',{})).flat().map(a=>normalizeActivity(a,0));
 const activities=await hydrateWeeklyFtfActivities({pages,cachedFlat,extractPage:p=>extractCalendarPageForWeeklyReport(p,{assignedPerson,calendarStatusField}),resolveReviewFlow:async(p,wf)=>knownReviewFlow(settings,p)||(wf==='review'?await cachedReviewFlow(settings,p):undefined)});
 const mirrors=await readDailySnapshotMirrors(settings,date,end,[...cachedFlat,...activities]);
 const meals=readWeeklyLocalJson<Record<string,any>>('meal_breaks.json',{});
 return buildFtfDashboard(actor,date,people,[...activities,...mirrors.map(a=>normalizeActivity(a,0))],state.values?.receipts?.ftfCompletions||{},now,presence,meals);
}
async function rpc(name:string,args:any){const {data,error}=await supabaseAdmin().rpc(name,args);if(error||(name==='finish_daily_report'&&data!==true))throw Error('No se confirmó el registro del reporte diario en Supabase.');return data;}
export async function runDailyReport(options:{actor:string;date?:string;now?:Date;dryRun?:boolean}){
 const now=options.now||new Date(),date=options.date||mexicoDate(now),skipped=dailyReportDay(date,now,!!options.dryRun);
 if(skipped)return {success:true,skipped,date};
 const settings=getSettings(),to=[...new Set(parseRecipients(settings.ftfEmailTo).map(x=>x.toLowerCase()))].sort();
 if(options.dryRun){const report=await buildDailyReport(settings,options.actor,date,now);return {success:true,dryRun:true,date,recipientsConfigured:to.length,people:report.people.length,subject:'Reporte diario ANFETA · '+date,report};}
 if(!supabaseConfigured())throw Error('Supabase es necesario para evitar reportes duplicados.');
 const key=createHash('sha256').update(JSON.stringify(['ftf-daily-v1',notionSourceKey(settings),date,to.map(x=>x.toLowerCase())])).digest('hex'),token=randomUUID();
 const claim=await rpc('claim_daily_report',{p_key:key,p_date:date,p_to:to,p_token:token});
 if(claim.state!=='claimed')return {success:claim.state==='sent',date,state:claim.state,skipped:claim.state,attempts:claim.attempts};
 let sending=false;
 try{
  if(!to.length)throw Error('Falta configurar FTF_REPORT_EMAIL_TO.');
  if(process.env.ANFETA_DISABLE_SMTP==='1'&&!settings.resendApiKey)throw Error('El envío por Gmail debe ejecutarse desde el trabajador externo de GitHub.');
  if(!(settings.smtpUser&&settings.smtpPass)&&!settings.resendApiKey)throw Error('Falta configurar el proveedor de correo.');
  const report=await buildDailyReport(settings,options.actor,date,now),subject='Reporte diario ANFETA · '+date,html=dailyReportHtml(report,date);
  await rpc('finish_daily_report',{p_key:key,p_token:token,p_state:'sending',p_payload:{subject,html,report}});sending=true;
  const email=await deliverHtmlEmail({apiKey:settings.resendApiKey,smtpUser:settings.smtpUser,smtpPass:settings.smtpPass,smtpHost:settings.smtpHost,smtpPort:settings.smtpPort,from:settings.ftfEmailFrom,to:to.join(','),subject,html,idempotencyKey:'anfeta-daily-'+key});
  const state=email.ok?'sent':email.uncertain?'uncertain':'failed';
  await rpc('finish_daily_report',{p_key:key,p_token:token,p_state:state,p_payload:{provider:email.provider,emailId:email.emailId,accepted:email.accepted,rejected:email.rejected,reason:email.ok?null:'El proveedor no confirmó el envío; revisa su registro.'}});
  return {success:email.ok,date,state,to,people:report.people.length,provider:email.provider,emailId:email.emailId};
 }catch(error){
  const message=error instanceof Error?error.message:'No se pudo generar el reporte.';
  await rpc('finish_daily_report',{p_key:key,p_token:token,p_state:sending?'uncertain':'failed',p_payload:{reason:sending?'No se confirmó la entrega. Revisa el proveedor antes de reenviar.':/Falta configurar/.test(message)?message:'No se pudo generar el reporte. Revisa Notion y Supabase.'}}).catch(()=>{});
  throw Error(sending?'El resultado del envío es incierto; revisa el registro antes de reenviar.':message);
 }
}
