import {createHmac,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
export const SHARED_COOKIE='anfeta_shared_access';
export function sharedAccessConfigured(){return Boolean(process.env.ANFETA_SHARED_AUTH_USER_ID);}
export function sharedAccountId(){const id=process.env.ANFETA_SHARED_AUTH_USER_ID||'';if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new Error('Configura ANFETA_SHARED_AUTH_USER_ID con el UUID de la cuenta de acceso.');return id;}
export interface SharedGate {baseId:string;selectedId:string;expires:number}
function secret(){const value=process.env.SUPABASE_SECRET_KEY;if(!value)throw new Error('Configura Supabase en el servidor.');return value;}
export function encodeSharedGate(gate:SharedGate){const data=Buffer.from(JSON.stringify(gate)).toString('base64url');return data+'.'+createHmac('sha256',secret()).update('anfeta-shared-v1:'+data).digest('base64url');}
export function decodeSharedGate(value:string):SharedGate|undefined{try{const [data,signature,extra]=value.split('.');if(!data||!signature||extra)return;const expected=createHmac('sha256',secret()).update('anfeta-shared-v1:'+data).digest();const actual=Buffer.from(signature,'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return;const gate=JSON.parse(Buffer.from(data,'base64url').toString());if(gate.baseId!==sharedAccountId()||!Number.isFinite(gate.expires)||gate.expires<=Date.now()||gate.expires>Date.now()+8*3600000+5000||typeof gate.selectedId!=='string')return;return gate;}catch{return;}}
export async function readSharedGate(){const store=await cookies();return decodeSharedGate(store.getAll().find(c=>c.name===SHARED_COOKIE)?.value||'');}
export async function saveSharedGate(gate:SharedGate){const store=await cookies();store.set(SHARED_COOKIE,encodeSharedGate(gate),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:Math.max(0,Math.floor((gate.expires-Date.now())/1000))});}
export async function clearSharedGate(){const store=await cookies();store.set(SHARED_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});}
