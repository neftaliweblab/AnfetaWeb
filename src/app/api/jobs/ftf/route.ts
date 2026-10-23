import {NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {getSettings} from '@/services/serverSettings';
import {prepareDailyFtf} from '@/services/prepareDailyFtf';
import {mexicoDate} from '@/services/calendarPresentation';
import {isDirection} from '@/services/activityPermissions';

export const maxDuration=120;
export async function GET(req:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||secret.length<32)return NextResponse.json({error:'Configura CRON_SECRET de al menos 32 caracteres.'},{status:503});
  const digest=(s:string)=>createHash('sha256').update(s).digest();
  if(!timingSafeEqual(digest(req.headers.get('authorization')||''),digest('Bearer '+secret)))return NextResponse.json({error:'No autorizado.'},{status:401});
  const actor=process.env.ANFETA_ROBOT_PERSON||'';
  if(!isDirection(actor))return NextResponse.json({error:'Configura ANFETA_ROBOT_PERSON como John o Neftali para el reinicio FTF del equipo.'},{status:503});
  try{
    const started=Date.now(),settings=getSettings(),day=mexicoDate();let reset=0,moved=0;
    let report=await prepareDailyFtf(settings,actor,day);reset+=report.reset;moved+=report.moved;
    while(report.remaining&&!report.failed&&Date.now()-started<80000){report=await prepareDailyFtf(settings,actor,day);reset+=report.reset;moved+=report.moved;}
    return NextResponse.json({success:!report.failed&&!report.remaining,...report,reset,moved},{status:report.failed||report.remaining?503:200,headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'No se pudo reiniciar FTF.'},{status:503});}
}
