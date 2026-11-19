import {NextResponse} from 'next/server';
import {requireActor,assertSameOrigin} from '@/services/serverAuth';
import {getSettings} from '@/services/serverSettings';
import {previewChecklistGrouping,applyChecklistGrouping} from '@/services/checklistGrouping';
import {assertChecklistAccess,checklistSnapshot} from '@/services/notionCalendar';
import {calendarActivityFromPage,recordPageEvent} from '@/services/notionEventSync';
import {notionSourceKey} from '@/services/notionSnapshotCache';
import {mexicoDate} from '@/services/calendarPresentation';
export const maxDuration=120;
export async function POST(req:Request){
 try{
  assertSameOrigin(req);const actor=await requireActor(req),input=await req.json();
  if(!['preview','apply'].includes(input.action))throw Error('Acción inválida.');
  const settings={...getSettings(),notionSignal:AbortSignal.timeout(90000)};
  if(input.action==='preview')return NextResponse.json({success:true,preview:await previewChecklistGrouping(settings,actor,input.pageId)},{headers:{'Cache-Control':'no-store'}});
  if(input.acknowledgeIds!==true)throw Error('Confirma el cambio de IDs antes de agrupar.');
  const outcome=await applyChecklistGrouping(settings,actor,input.pageId,input.fingerprint);
  let stats:any;
  try{
   const page=await assertChecklistAccess(settings,actor,input.pageId),day=/^\d{4}-\d{2}-\d{2}$/.test(input.workDate||'')?input.workDate:mexicoDate();
   stats=await checklistSnapshot(settings,page,day);
   const card=calendarActivityFromPage(page,settings.notionDataSourceId);
   await recordPageEvent({sourceKey:notionSourceKey(settings),pageId:input.pageId,state:'active',eventType:'page.content_updated',serverModified:page.last_edited_time,properties:{...(card?{calendarActivity:{...card,...stats}}:{}),checklistUpdate:stats}});
  }catch{outcome.errors.push('La agrupación se procesó, pero falta actualizar los contadores. Recarga el detalle.');}
  return NextResponse.json({success:!outcome.errors.length,...outcome,stats},{headers:{'Cache-Control':'no-store'}});
 }catch(error){const message=error instanceof Error?error.message:'No se confirmó la agrupación.';return NextResponse.json({error:message},{status:/Inicia sesión/.test(message)?401:400,headers:{'Cache-Control':'no-store'}});}
}
