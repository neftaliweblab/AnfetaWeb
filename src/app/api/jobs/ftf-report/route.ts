import {NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {isDirection} from '@/services/activityPermissions';
import {runDailyReport} from '@/services/ftfDailyReport';
export const maxDuration=120;
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32)return NextResponse.json({error:'Configura CRON_SECRET de al menos 32 caracteres.'},{status:503});
 const digest=(v:string)=>createHash('sha256').update(v).digest();
 if(!timingSafeEqual(digest(req.headers.get('authorization')||''),digest('Bearer '+secret)))return NextResponse.json({error:'No autorizado.'},{status:401});
 const actor=process.env.ANFETA_ROBOT_PERSON||'Neftali';
 if(!isDirection(actor))return NextResponse.json({error:'El robot debe estar configurado como Dirección.'},{status:503});
 try{const params=new URL(req.url).searchParams,result=await runDailyReport({actor,date:params.get('date')||undefined,dryRun:params.get('dryRun')==='1'});return NextResponse.json(result,{status:result.success?200:503,headers:{'Cache-Control':'no-store'}});}
 catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:'No se pudo enviar el reporte diario.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
