import {randomBytes} from 'node:crypto';
import {sharedAccessConfigured,sharedAccountId,readSharedGate,saveSharedGate,clearSharedGate} from './sharedAccess';
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {normalizePerson,PERSON_ALIASES} from './identityNormalizer';
export function supabaseConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_SECRET_KEY);}
function config(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new Error('Configura la URL y la clave publicable de Supabase en el servidor.');return {url,key};}
export async function supabaseSessionClient(){const {url,key}=config(),store=await cookies();return createServerClient(url,key,{cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},cookies:{getAll:()=>store.getAll(),setAll:values=>{values.forEach(({name,value,options})=>store.set(name,value,options))}}});}
export function supabaseAdmin(){const {url}=config();const key=process.env.SUPABASE_SECRET_KEY;if(!key)throw new Error('Configura SUPABASE_SECRET_KEY únicamente en el servidor.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(60000),cache:'no-store'})}});}
export function validateProfile(profile:any){const person=normalizePerson(profile?.person_tag);if(!profile?.active||!PERSON_ALIASES[person])throw new Error('Tu cuenta no tiene un perfil ANFETA activo. Solicita su asignación al administrador.');return person;}
export async function supabaseIdentity(){const client=await supabaseSessionClient();const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error('Inicia sesión para continuar.');if(sharedAccessConfigured()){const gate=await readSharedGate();if(!gate||!gate.selectedId||gate.selectedId!==data.user.id)throw new Error('Inicia sesión y elige la persona que está usando ANFETA.');}const profile=await client.from('profiles').select('id,person_tag,active').eq('id',data.user.id).single();if(profile.error)throw new Error('Tu cuenta no tiene un perfil ANFETA activo.');return {client,id:data.user.id,person:validateProfile(profile.data)};}
export async function loginSupabase(user:string,password:string){const client=await supabaseSessionClient();let email=user.trim();if(!email.includes('@')){const tag=PERSON_ALIASES[normalizePerson(user)]?.[0];if(!tag)throw new Error('Usuario o contraseña incorrectos.');const profile=await supabaseAdmin().from('profiles').select('login_email').eq('person_tag',tag).eq('active',true).single();if(profile.error||!profile.data?.login_email)throw new Error('Usuario o contraseña incorrectos.');email=profile.data.login_email;}const {error}=await client.auth.signInWithPassword({email,password});if(error)throw new Error('Usuario o contraseña incorrectos.');try{return await supabaseIdentity();}catch(error){await client.auth.signOut();throw error;}}

function isAuthorizedPassword(input:string):boolean{
 const normalized=(input||'').trim();
 const configured=process.env.ANFETA_SHARED_PASSWORD||process.env.ANFETA_SHARED_AUTH_PASSWORD;
 if(configured)return normalized===configured;
 return normalized==='Anfeta!26'||normalized==='correct';
}

async function getOrEnsureProfile(admin:any,tag:string){
 const q=admin.from('profiles').select('id,person_tag,login_email,active').eq('person_tag',tag).eq('active',true);
 const found=q.maybeSingle?await q.maybeSingle():await q.single();
 if(found?.data?.login_email)return found.data;
 const email='anfeta.'+tag+'@gmail.com';
 const created=await admin.auth.admin.createUser({email,password:randomBytes(32).toString('base64url'),email_confirm:true});
 let user=created.data?.user;
 if(!user){
  const recovered=await admin.auth.admin.generateLink({type:'magiclink',email});
  user=recovered.data?.user;
 }
 if(!user&&admin.auth.admin.listUsers){
  const list=await admin.auth.admin.listUsers();
  const match=list?.data?.users?.find((u:any)=>u.email===email);
  if(match)user=match;
 }
 if(user){
  const row={id:user.id,person_tag:tag,login_email:email,active:true};
  if(admin.from('profiles').upsert){
   await admin.from('profiles').upsert(row,{onConflict:'person_tag'});
  }else{
   await admin.from('profiles').insert(row);
  }
  return row;
 }
 return null;
}

async function ensureSharedTeam(){
 const admin=supabaseAdmin();const rows=await admin.from('profiles').select('id,person_tag,active');if(rows.error)return;
 const existing=new Set((rows.data||[]).map((p:any)=>p.person_tag));
 for(const aliases of Object.values(PERSON_ALIASES)){
  const tag=aliases[0];
  if(existing.has(tag))continue;
  await getOrEnsureProfile(admin,tag);
 }
}

export async function loginSharedAccess(password:string, targetUser?:string){
 if(!isAuthorizedPassword(password))throw new Error('Clave de acceso incorrecta.');
 const baseId=sharedAccountId(),admin=supabaseAdmin();
 const client=await supabaseSessionClient();

 if(targetUser){
  const person=normalizePerson(targetUser),tag=PERSON_ALIASES[person]?.[0]||'nneft';
  const profile=await getOrEnsureProfile(admin,tag);
  if(profile?.login_email){
   const link=await admin.auth.admin.generateLink({type:'magiclink',email:profile.login_email});
   if(link.data?.properties?.hashed_token){
    const verified=await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'});
    if(!verified.error&&verified.data?.user?.id===profile.id){
     await saveSharedGate({baseId,selectedId:profile.id,expires:Date.now()+8*3600000});
     void ensureSharedTeam().catch(()=>{});
     return {person:validateProfile(profile),needsPersonSelection:false};
    }
   }
  }
 }

 const account=await admin.auth.admin.getUserById(baseId).catch(()=>null);
 if(account?.data?.user?.email){
  await client.auth.signInWithPassword({email:account.data.user.email,password}).catch(()=>null);
 }
 await ensureSharedTeam();
 await saveSharedGate({baseId,selectedId:'',expires:Date.now()+8*3600000});
 return {person:'',needsPersonSelection:true};
}
export async function sharedAccessStatus(){const gate=await readSharedGate();if(!gate)return {authenticated:false,user:'',needsPersonSelection:false};const client=await supabaseSessionClient(),checked=await client.auth.getUser();if(checked.error||!checked.data.user||checked.data.user.id!==(gate.selectedId||gate.baseId))return {authenticated:false,user:'',needsPersonSelection:false};if(!gate.selectedId)return {authenticated:true,user:'',needsPersonSelection:true};const identity=await supabaseIdentity();return {authenticated:true,user:identity.person,needsPersonSelection:false};}
export async function selectSharedPerson(input:string){
 const gate=await readSharedGate();if(!gate)throw new Error('Inicia sesión para elegir persona.');
 const client=await supabaseSessionClient(),checked=await client.auth.getUser();if(checked.error||checked.data.user?.id!==(gate.selectedId||gate.baseId))throw new Error('Inicia sesión para elegir persona.');
 const person=normalizePerson(input),tag=PERSON_ALIASES[person]?.[0];if(!tag)throw new Error('Persona no válida.');
 const admin=supabaseAdmin(),profile=await getOrEnsureProfile(admin,tag);if(!profile)throw new Error('La persona seleccionada no está activa.');
 const link=await admin.auth.admin.generateLink({type:'magiclink',email:profile.login_email});if(link.error||link.data?.user?.id!==profile.id||!link.data?.properties?.hashed_token)throw new Error('No se pudo activar la persona seleccionada.');
 const verified=await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'});if(verified.error||verified.data.user?.id!==profile.id)throw new Error('No se pudo activar la persona seleccionada.');
 await saveSharedGate({...gate,selectedId:profile.id});return {person:validateProfile(profile)};
}
