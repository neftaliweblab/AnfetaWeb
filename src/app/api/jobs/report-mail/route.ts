import {NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {isDirection} from '@/services/activityPermissions';
import {prepareReportMail,finishReportMail} from '@/services/reportMailRelay';
export const maxDuration=120;
export async function POST(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32)return NextResponse.json({error:'Falta configuración del programador.'},{status:503});
 const digest=(s:string)=>createHash('sha256').update(s).digest();
 if(!timingSafeEqual(digest(req.headers.get('authorization')||''),digest('Bearer '+secret)))return NextResponse.json({error:'No autorizado.'},{status:401});
 const actor=process.env.ANFETA_ROBOT_PERSON||'Neftali';if(!isDirection(actor))return NextResponse.json({error:'Responsable del programador inválido.'},{status:503});
 try{const text=await req.text();if(text.length>6000)throw Error('Solicitud demasiado grande.');const input=JSON.parse(text);let result;
 if(input.action==='prepare')result=await prepareReportMail(actor,input);else if(input.action==='finish')result=await finishReportMail(input);else throw Error('Acción inválida.');
 return NextResponse.json(result,{status:result.success?200:409,headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:'No se confirmó el reporte.'},{status:400,headers:{'Cache-Control':'no-store'}});}
}
