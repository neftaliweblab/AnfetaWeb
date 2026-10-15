import {NextResponse} from 'next/server';
import {requireActor} from '@/services/serverAuth';
import {activeTeam} from '@/services/teamDirectory';
export async function GET(req:Request){try{await requireActor(req);return NextResponse.json({people:await activeTeam()},{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'No se pudo leer el equipo.'},{status:503});}}
