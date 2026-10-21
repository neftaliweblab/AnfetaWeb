import {supabaseAdmin, getOrEnsureProfile} from './supabaseServer';
import {normalizePerson,PERSON_ALIASES} from './identityNormalizer';
async function owner(user:string){
  const tag=PERSON_ALIASES[normalizePerson(user)]?.[0];
  if(!tag)throw Error('Persona no válida para preferencias.');
  const client=supabaseAdmin();
  let profile=await client.from('profiles').select('id').eq('person_tag',tag).eq('active',true).maybeSingle();
  if(!profile.data?.id){
    try {
      const ensured = await getOrEnsureProfile(client, tag);
      if(ensured?.id) return {client, id: ensured.id};
    } catch {}
  }
  if(profile.error||!profile.data?.id)throw Error('No se confirmó el perfil activo para guardar preferencias.');
  return {client,id:profile.data.id};
}
export async function readSupabasePreferences(user:string){const {client,id}=await owner(user);const {data,error}=await client.from('user_preferences').select('revision,values,updated_at').eq('user_id',id).maybeSingle();if(error)throw Error('No se pudieron consultar las preferencias de esta persona.');return data?{provider:'supabase',revision:Number(data.revision),values:data.values,updatedAt:data.updated_at}:{provider:'supabase',revision:0,values:{}};}
export async function updateSupabasePreferences(user:string,patch:Record<string,any>,expectedRevision?:number){const {client,id}=await owner(user);const {data,error}=await client.rpc('update_anfeta_preferences',{p_user_id:id,p_patch:patch,p_expected_revision:expectedRevision??null});if(error||!data)throw Error(error?.message?.includes('revision_conflict')?'La configuración cambió en otro dispositivo. Actualiza y vuelve a guardar.':'No se confirmaron las preferencias. Revisa Supabase y su migración; se conserva la copia anterior.');return {revision:Number(data.revision),values:data.values,updatedAt:data.updated_at};}
