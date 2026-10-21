import {supabaseTransport} from './authRequestScope';
import {supabaseConnectionConfig} from './supabaseConfiguration';
import {randomBytes} from 'node:crypto';
import {sharedAccessConfigured,sharedAccountId,readSharedGate,saveSharedGate,clearSharedGate} from './sharedAccess';
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {normalizePerson,PERSON_ALIASES} from './identityNormalizer';
export function supabaseConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_SECRET_KEY);}
function config(){return supabaseConnectionConfig();}
export async function supabaseSessionClient(){const {url,key}=config(),store=await cookies();return createServerClient(url,key,{cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},cookies:{getAll:()=>store.getAll(),setAll:values=>{values.forEach(({name,value,options})=>store.set(name,value,options))}},global:{fetch:(input,init)=>supabaseTransport(input,init,30000)}});}
let adminClientInstance: any = null;
export function supabaseAdmin(){
  if (adminClientInstance) return adminClientInstance;
  const {url}=config();
  const key=process.env.SUPABASE_SECRET_KEY?.trim();
  if(!key)throw new Error('Configura SUPABASE_SECRET_KEY únicamente en el servidor.');
  adminClientInstance = createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:(input,init)=>supabaseTransport(input,init,60000)}
  });
  return adminClientInstance;
}
export function validateProfile(profile:any){const person=normalizePerson(profile?.person_tag);if(!profile?.active||!PERSON_ALIASES[person])throw new Error('Tu cuenta no tiene un perfil ANFETA activo. Solicita su asignación al administrador.');return person;}

function serviceError(error:any,context:string){const message=String(error?.message||'');if(/timeout|abort|fetch|network/i.test(message)||error?.status>=500)return Object.assign(new Error('Supabase no está disponible temporalmente durante '+context+'. Intenta de nuevo; no se activó una sesión provisional.'),{status:503});return new Error(context+'. Revisa la configuración de Supabase y los permisos del servidor.');}
let inFlightIdentity: { key: string; promise: Promise<{ id: string; person: string }> } | null = null;

async function checkedUser(client: any, timeoutMs = 14000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await Promise.race([
        client.auth.getUser(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Supabase tardó demasiado en verificar o renovar la sesión. Intenta de nuevo.')),
            attempt === 0 ? timeoutMs : 12000
          );
        }),
      ]);
      if (res?.error && attempt === 0 && (/timeout|abort|fetch|network|ECONNRESET/i.test(String(res.error.message || '')) || res.error.status >= 500)) {
        if (timer) { clearTimeout(timer); timer = undefined; }
        await new Promise((res) => setTimeout(res, 800));
        continue;
      }
      return res;
    } catch (err: any) {
      if (timer) { clearTimeout(timer); timer = undefined; }
      if (attempt === 0 && (/tardó demasiado|timeout|network|ECONNRESET|fetch failed/i.test(String(err?.message || '')))) {
        await new Promise((res) => setTimeout(res, 800));
        continue;
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

async function checkedSignIn(client: any, credentials: any) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      client.auth.signInWithPassword(credentials),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Supabase tardó demasiado en iniciar sesión. Intenta de nuevo.')), 10000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function supabaseIdentity() {
  const store = await cookies();
  const sessionKey = store.getAll().map((c) => `${c.name}:${c.value}`).sort().join(';');
  const client = await supabaseSessionClient();

  if (inFlightIdentity && inFlightIdentity.key === sessionKey) {
    const shared = await inFlightIdentity.promise;
    return { client, id: shared.id, person: shared.person };
  }

  const resolveIdentity = async () => {
    let result: any;
    try {
      result = await checkedUser(client);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Supabase tardó')) throw error;
      throw serviceError(error, 'verificar la sesión');
    }
    if (result.error && (/timeout|abort|fetch|network/i.test(String(result.error.message)) || result.error.status >= 500)) {
      throw serviceError(result.error, 'verificar la sesión');
    }
    if (result.error || !result.data?.user) throw new Error('Inicia sesión para continuar.');
    const user = result.data.user, gate = sharedAccessConfigured() ? await readSharedGate() : undefined;
    if (sharedAccessConfigured() && (!gate?.selectedId || gate.selectedId !== user.id)) {
      throw new Error('Inicia sesión y elige la persona que está usando ANFETA.');
    }
    const profile = await client.from('profiles').select('id,person_tag,active').eq('id', user.id).single();
    if (profile.error && (/timeout|abort|fetch|network/i.test(String(profile.error.message)) || profile.status >= 500)) {
      throw serviceError({ ...profile.error, status: profile.status }, 'leer el perfil activo');
    }
    if (profile.error || !profile.data) throw new Error('Tu cuenta no tiene un perfil ANFETA activo. Revisa la tabla profiles.');
    return { id: user.id, person: validateProfile(profile.data) };
  };

  const currentPromise = resolveIdentity();
  inFlightIdentity = { key: sessionKey, promise: currentPromise };
  try {
    const resolved = await currentPromise;
    return { client, id: resolved.id, person: resolved.person };
  } finally {
    if (inFlightIdentity?.promise === currentPromise) {
      inFlightIdentity = null;
    }
  }
}
export async function loginSupabase(user:string,password:string){const client=await supabaseSessionClient();let email=user.trim();if(!email.includes('@')){const tag=PERSON_ALIASES[normalizePerson(user)]?.[0];if(!tag)throw new Error('Usuario o contraseña incorrectos.');const profile=await supabaseAdmin().from('profiles').select('login_email').eq('person_tag',tag).eq('active',true).single();if(profile.error||!profile.data?.login_email)throw new Error('Usuario o contraseña incorrectos.');email=profile.data.login_email;}const {error}=await checkedSignIn(client,{email,password});if(error)throw new Error('Usuario o contraseña incorrectos.');try{return await supabaseIdentity();}catch(error){await client.auth.signOut();throw error;}}

export async function getOrEnsureProfile(admin:any,tag:string){
 const person=normalizePerson(tag);if(!PERSON_ALIASES[person])throw new Error('Persona no válida.');
 const q=admin.from('profiles').select('id,person_tag,login_email,active').eq('person_tag',tag);
 const found=q.maybeSingle?await q.maybeSingle():await q.single();
 if(found.error&&found.error.code!=='PGRST116')throw serviceError(found.error,'leer el perfil de la persona');
 if(found.data){validateProfile(found.data);if(!found.data.login_email)throw new Error('El perfil no tiene correo de acceso. Revisa profiles.login_email.');return found.data;}
 // Provision only the selected missing account, never every account on login.
 const email='anfeta-persona-'+tag+'@internal.anfeta.invalid';
 const created=await admin.auth.admin.createUser({email,password:randomBytes(32).toString('base64url'),email_confirm:true});
 if(created.error||!created.data?.user)throw serviceError(created.error,'crear la cuenta interna seleccionada');
 const row={id:created.data.user.id,person_tag:tag,login_email:email,active:true};
 const inserted=await admin.from('profiles').insert(row);
 if(inserted.error)throw serviceError(inserted.error,'guardar el perfil de la persona');
 return row;
}

export async function loginSharedAccess(password:string,_targetUser?:string){
 const baseId=sharedAccountId(),admin=supabaseAdmin(),client=await supabaseSessionClient();
 if(!password||password.length>1024)throw new Error('Clave de acceso incorrecta.');
 let account:any;try{account=await admin.auth.admin.getUserById(baseId);}catch(error){throw serviceError(error,'consultar la cuenta de acceso compartido');}
 if(account.error){if([401,403].includes(account.error.status)||/api key|jwt|not authorized|not admin/i.test(String(account.error.message)))throw new Error('SUPABASE_SECRET_KEY no permite consultar Authentication. Revisa que la URL y la clave secreta del servidor pertenezcan al mismo proyecto; no uses la clave publicable como secreta.');if(account.error.status!==404&&account.error.code!=='user_not_found')throw serviceError(account.error,'consultar la cuenta de acceso compartido');}
 if(account.error||!account.data?.user?.email)throw new Error('La cuenta de ANFETA_SHARED_AUTH_USER_ID no existe en Authentication de este proyecto Supabase o no tiene correo. Usa el UUID de Authentication > Users, no el ID del proyecto.');
 const signed=await checkedSignIn(client,{email:account.data.user.email,password});
 if(signed.error){if(signed.error.code==='email_not_confirmed')throw new Error('El correo de la cuenta compartida no está confirmado. Confírmalo en Supabase Authentication.');if(/timeout|fetch|network/i.test(String(signed.error.message))||signed.error.status>=500)throw serviceError(signed.error,'iniciar sesión');throw new Error('Clave de acceso incorrecta para la cuenta compartida.');}
 const verified=signed.data?.user||(await checkedUser(client)).data?.user;
 if(!verified||verified.id!==baseId)throw new Error('Supabase no confirmó la cuenta compartida. No se abrió el acceso.');
 await saveSharedGate({baseId,selectedId:'',expires:Date.now()+8*3600000});
 return {person:'',needsPersonSelection:true};
}
export async function sharedAccessStatus(){const gate=await readSharedGate();if(!gate)return {authenticated:false,user:'',needsPersonSelection:false};if(!gate.selectedId){const client=await supabaseSessionClient(),checked=await checkedUser(client);if(checked.error&&/timeout|abort|fetch|network/i.test(String(checked.error.message)))throw serviceError(checked.error,'verificar el acceso común');if(!checked.data?.user||checked.data.user.id!==gate.baseId){await clearSharedGate();return {authenticated:false,user:'',needsPersonSelection:false};}return {authenticated:true,user:'',needsPersonSelection:true};}const identity=await supabaseIdentity();return {authenticated:true,user:identity.person,ownerId:identity.id,needsPersonSelection:false};}
export async function selectSharedPerson(input:string){
 const gate=await readSharedGate();if(!gate)throw new Error('Inicia sesión para elegir persona.');
 const person=normalizePerson(input),tag=PERSON_ALIASES[person]?.[0];if(!tag)throw new Error('Persona no válida.');
 const client=await supabaseSessionClient();const checked=await checkedUser(client);
 if(checked.error&&/timeout|abort|fetch|network/i.test(String(checked.error.message)))throw serviceError(checked.error,'verificar la persona activa');
 if(checked.error||!checked.data?.user||checked.data.user.id!==(gate.selectedId||gate.baseId))throw new Error('Inicia sesión para elegir persona.');
 const admin=supabaseAdmin(),profile=await getOrEnsureProfile(admin,tag);
 let link: any;
 for (let attempt = 0; attempt < 2; attempt++) {
   link = await admin.auth.admin.generateLink({type:'magiclink',email:profile.login_email});
   if (!link.error && link.data?.properties?.hashed_token) break;
   if (attempt === 0) await new Promise(r => setTimeout(r, 600));
 }
 if(link.error||!link.data?.properties?.hashed_token)throw serviceError(link.error,'activar la persona');
 let verified: any;
 for (let attempt = 0; attempt < 2; attempt++) {
   verified = await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'});
   if (!verified.error && verified.data?.user?.id === profile.id) break;
   if (attempt === 0) await new Promise(r => setTimeout(r, 600));
 }
 if(verified.error||verified.data?.user?.id!==profile.id)throw new Error('Supabase no confirmó la sesión de la persona. No se guardó la selección.');
 await saveSharedGate({...gate,selectedId:profile.id,person,personTag:tag});return {person:validateProfile(profile)};
}
