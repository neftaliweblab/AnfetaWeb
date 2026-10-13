import {supabaseAdmin,getOrEnsureProfile} from './supabaseServer';import {sharedAccountId} from './sharedAccess';import {normalizePerson,PERSON_ALIASES} from './identityNormalizer';

// Caché en memoria de IDs de perfil para no consultar la tabla profiles en cada petición
const profileIdCache = new Map<string, string>();

// Caché en memoria de preferencias con TTL de 20s para amortiguar lecturas repetidas de componentes
const prefsCache = new Map<string, { data: any; expiresAt: number }>();

async function owner(user:string){
  const tag=PERSON_ALIASES[normalizePerson(user)]?.[0]||'nneft';
  const client=supabaseAdmin();
  if (profileIdCache.has(tag)) {
    return { client, id: profileIdCache.get(tag)! };
  }
  let profile:any=null;
  try{profile=await getOrEnsureProfile(client,tag);}catch{}
  if(!profile){
    try{
      const q=await client.from('profiles').select('id').eq('person_tag',tag).eq('active',true).maybeSingle();
      profile=q?.data;
    }catch{}
  }
  const id=profile?.id||sharedAccountId();
  if (id) profileIdCache.set(tag, id);
  return {client,id};
}

export async function readSupabasePreferences(user:string){
  const cacheKey = normalizePerson(user);
  const cached = prefsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  try{
    const {client,id}=await owner(user);
    const {data,error}=await client.from('user_preferences').select('revision,values,updated_at').eq('user_id',id).maybeSingle();
    if(error) return {provider:'supabase',revision:0,values:{}};
    const result = data
      ? {provider:'supabase',revision:Number(data.revision),values:data.values,updatedAt:data.updated_at}
      : {provider:'supabase',revision:0,values:{}};
    prefsCache.set(cacheKey, { data: result, expiresAt: Date.now() + 20000 });
    return result;
  }catch{
    return {provider:'supabase',revision:0,values:{}};
  }
}

export async function updateSupabasePreferences(user:string,patch:Record<string,any>,expectedRevision?:number){
  const cacheKey = normalizePerson(user);
  prefsCache.delete(cacheKey);
  try{
    const {client,id}=await owner(user);
    const {data,error}=await client.rpc('update_anfeta_preferences',{p_user_id:id,p_patch:patch,p_expected_revision:expectedRevision??null});
    if(error){
      if(error.message.includes('revision_conflict'))throw new Error('La configuración cambió en otro dispositivo. Actualiza y vuelve a guardar.');
      try{
        const upsert=await client.from('user_preferences').upsert({user_id:id,values:patch,revision:(expectedRevision||0)+1,updated_at:new Date().toISOString()}).select('revision,values,updated_at').single();
        if(!upsert.error&&upsert.data){
          const res = {revision:Number(upsert.data.revision),values:upsert.data.values,updatedAt:upsert.data.updated_at};
          prefsCache.set(cacheKey, { data: { provider: 'supabase', ...res }, expiresAt: Date.now() + 20000 });
          return res;
        }
      }catch{}
      return {revision:(expectedRevision||0)+1,values:patch,updatedAt:new Date().toISOString()};
    }
    const res = {revision:Number(data.revision),values:data.values,updatedAt:data.updated_at};
    prefsCache.set(cacheKey, { data: { provider: 'supabase', ...res }, expiresAt: Date.now() + 20000 });
    return res;
  }catch(e:any){
    if(e?.message?.includes('otro dispositivo'))throw e;
    return {revision:(expectedRevision||0)+1,values:patch,updatedAt:new Date().toISOString()};
  }
}
