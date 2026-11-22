import {NextResponse} from 'next/server';
/** Cheap readiness check: never query Notion/Supabase or renew a user session. */
export function GET(){return NextResponse.json({ok:true,service:'anfeta'},{headers:{'Cache-Control':'no-store'}});}
