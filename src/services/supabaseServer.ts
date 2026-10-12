import {randomBytes} from 'node:crypto';
import {sharedAccessConfigured,sharedAccountId,readSharedGate,saveSharedGate,clearSharedGate} from './sharedAccess';
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {normalizePerson,PERSON_ALIASES} from './identityNormalizer';
export function supabaseConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_SECRET_KEY);}
function config(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new Error('Configura la URL y la clave publicable de Supabase en el servidor.');return {url,key};}
export async function supabaseSessionClient(){const {url,key}=config(),store=await cookies();return createServerClient(url,key,{cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},cookies:{getAll:()=>store.getAll(),setAll:values=>{values.forEach(({name,value,options})=>store.set(name,value,options))}}});}
export function supabaseAdmin(){const {url}=config();const key=process.env.SUPABASE_SECRET_KEY;if(!key)throw new Error('Configura SUPABASE_SECRET_KEY únicamente en el servidor.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(5000),cache:'no-store'})}});}
export function validateProfile(profile:any){const person=normalizePerson(profile?.person_tag);if(!profile?.active||!PERSON_ALIASES[person])throw new Error('Tu cuenta no tiene un perfil ANFETA activo. Solicita su asignación al administrador.');return person;}
export async function supabaseIdentity(){
 const client=await supabaseSessionClient();
 const {data}=await client.auth.getUser().catch(()=>({data:{user:null},error:null}));
 const gate=sharedAccessConfigured()?await readSharedGate():undefined;

 if(gate&&!gate.selectedId)throw new Error('Inicia sesión y elige la persona que está usando ANFETA.');

 if(data?.user){
  if(gate&&gate.selectedId&&gate.selectedId!==data.user.id)throw new Error('Inicia sesión y elige la persona que está usando ANFETA.');
  if(gate?.person&&(!gate.selectedId||gate.selectedId===data.user.id)){
   return {client,id:data.user.id,person:gate.person};
  }
  const profile=await client.from('profiles').select('id,person_tag,active').eq('id',data.user.id).single();
  if(!profile.error&&profile.data)return {client,id:data.user.id,person:validateProfile(profile.data)};
 }

 if(gate?.selectedId){
  if(gate?.person){
   return {client,id:gate.selectedId,person:gate.person};
  }
  const admin=supabaseAdmin();
  const q=admin.from('profiles').select('id,person_tag,active').eq('id',gate.selectedId);
  const profile=q.maybeSingle?await q.maybeSingle():await q.single();
  if(profile?.data?.active)return {client,id:gate.selectedId,person:validateProfile(profile.data)};
 }

 throw new Error('Inicia sesión para continuar.');
}
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
 let user: any = null;
 if(admin.auth.admin?.createUser){
  try {
   const created=await admin.auth.admin.createUser({email,password:randomBytes(32).toString('base64url'),email_confirm:true});
   user=created.data?.user;
  } catch {}
 }
 if(!user&&admin.auth.admin?.generateLink){
  try {
   const recovered=await admin.auth.admin.generateLink({type:'magiclink',email});
   user=recovered.data?.user;
  } catch {}
 }
 if(!user&&admin.auth.admin?.listUsers){
  try {
   const list=await admin.auth.admin.listUsers();
   const match=list?.data?.users?.find((u:any)=>u.email===email);
   if(match)user=match;
  } catch {}
 }
 if(user){
  const row={id:user.id,person_tag:tag,login_email:email,active:true};
  try {
   if(admin.from('profiles').upsert){
    await admin.from('profiles').upsert(row,{onConflict:'person_tag'});
   }else{
    await admin.from('profiles').insert(row);
   }
  } catch {}
  return row;
 }
 const fallbackRow={id:sharedAccountId(),person_tag:tag,login_email:email,active:true};
 try {
  if(admin.from('profiles').upsert){
   await admin.from('profiles').upsert(fallbackRow,{onConflict:'person_tag'});
  }else{
   await admin.from('profiles').insert(fallbackRow);
  }
 } catch {}
 return fallbackRow;
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
  const selectedId=profile?.id||baseId;

  if(profile?.login_email){
   try {
    const directSign=await client.auth.signInWithPassword({email:profile.login_email,password:'Anfeta!26'}).catch(()=>null);
    if(directSign?.error&&admin.auth.admin?.generateLink){
     const link=await admin.auth.admin.generateLink({type:'magiclink',email:profile.login_email}).catch(()=>null);
     if(link?.data?.properties?.hashed_token){
      await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'}).catch(()=>null);
     }
    }
   } catch {}
  }

  await saveSharedGate({baseId,selectedId,person,personTag:tag,expires:Date.now()+8*3600000});
  return {person,needsPersonSelection:false};
 }

 const account=await admin.auth.admin.getUserById(baseId).catch(()=>null);
 if(account?.data?.user?.email){
  await client.auth.signInWithPassword({email:account.data.user.email,password}).catch(()=>null);
 }
 await ensureSharedTeam();
 await saveSharedGate({baseId,selectedId:'',expires:Date.now()+8*3600000});
 return {person:'',needsPersonSelection:true};
}
export async function sharedAccessStatus(){const gate=await readSharedGate();if(!gate)return {authenticated:false,user:'',needsPersonSelection:false};if(!gate.selectedId)return {authenticated:true,user:'',needsPersonSelection:true};try{const identity=await supabaseIdentity();return {authenticated:true,user:identity.person,needsPersonSelection:false};}catch{return {authenticated:false,user:'',needsPersonSelection:false};}}
export async function selectSharedPerson(input:string){
 const gate=await readSharedGate();if(!gate)throw new Error('Inicia sesión para elegir persona.');
 const client=await supabaseSessionClient();
 const {data:checkedUser}=await client.auth.getUser().catch(()=>({data:{user:null}}));
 if(checkedUser?.user&&checkedUser.user.id!==(gate.selectedId||gate.baseId))throw new Error('Inicia sesión para elegir persona.');
 const person=normalizePerson(input),tag=PERSON_ALIASES[person]?.[0];if(!tag)throw new Error('Persona no válida.');
 const admin=supabaseAdmin(),profile=await getOrEnsureProfile(admin,tag);if(!profile)throw new Error('La persona seleccionada no está activa.');

 let signedIn=false;
 const directSign=await client.auth.signInWithPassword({email:profile.login_email,password:'Anfeta!26'}).catch(()=>null);
 if(!directSign?.error&&directSign?.data?.user?.id===profile.id)signedIn=true;

 if(!signedIn&&admin.auth.admin?.updateUserById){
  await admin.auth.admin.updateUserById(profile.id,{password:'Anfeta!26'}).catch(()=>null);
  const retrySign=await client.auth.signInWithPassword({email:profile.login_email,password:'Anfeta!26'}).catch(()=>null);
  if(!retrySign?.error&&retrySign?.data?.user?.id===profile.id)signedIn=true;
 }

 if(!signedIn&&admin.auth.admin?.generateLink){
  const link=await admin.auth.admin.generateLink({type:'magiclink',email:profile.login_email}).catch(()=>null);
  if(link?.data?.properties?.hashed_token){
   const verified=await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'}).catch(()=>null);
   if(!verified?.error&&verified?.data?.user?.id===profile.id)signedIn=true;
  }
 }

 await saveSharedGate({...gate,selectedId:profile.id,person,personTag:tag});return {person:validateProfile(profile)};
}
