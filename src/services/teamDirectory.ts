import {PERSON_ALIASES,PERSON_METADATA,normalizePerson} from './identityNormalizer';
import {supabaseConfigured,supabaseAdmin} from './supabaseServer';
export async function activeTeam(){
  let names=Object.keys(JSON.parse(process.env.ANFETA_AUTH_USERS||'{}')).map(normalizePerson).filter(name=>!!PERSON_ALIASES[name]);
  if(supabaseConfigured()){
    const result=await supabaseAdmin().from('profiles').select('person_tag').eq('active',true);
    if(result.error)throw Error('No se pudieron verificar los integrantes activos. Intenta de nuevo.');
    names=[...new Set<string>((result.data||[]).map((p:any)=>normalizePerson(p.person_tag)))].filter(name=>!!PERSON_ALIASES[name]);
  }
  return names.map(name=>({name,alias:PERSON_ALIASES[name][0],...PERSON_METADATA[name]}));
}
