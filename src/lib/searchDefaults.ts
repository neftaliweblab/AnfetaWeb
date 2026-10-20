export const SEARCH_TAGS=['Ninguno','prtuzREVISION','zclientes','zdominios','zproyectos','zpagar','zcorreos','Personalizado'];
export type SearchDefaults={selectedTag:string;customTag:string};
export const EMPTY_SEARCH_DEFAULTS:SearchDefaults={selectedTag:'Ninguno',customTag:''};
export function searchDefaultsKey(owner:string){return 'anfeta_search_defaults_v1:'+owner;}
export function readSearchDefaults(storage:Pick<Storage,'getItem'|'setItem'>,owner:string):SearchDefaults{
  try{
    const raw=storage.getItem(searchDefaultsKey(owner));
    if(raw){const saved=JSON.parse(raw);return {selectedTag:SEARCH_TAGS.includes(saved.selectedTag)?saved.selectedTag:'Ninguno',customTag:typeof saved.customTag==='string'?saved.customTag.slice(0,4000):''};}
    // Legacy preferences had no owner. Assign them only to the first migrating account.
    const legacyOwner=storage.getItem('anfeta_search_defaults_legacy_owner');
    if(!legacyOwner||legacyOwner===owner){
      const selectedTag=storage.getItem('anfeta_default_tag')||'Ninguno',customTag=storage.getItem('anfeta_custom_tag')||'';
      storage.setItem('anfeta_search_defaults_legacy_owner',owner);
      return {selectedTag:SEARCH_TAGS.includes(selectedTag)?selectedTag:'Ninguno',customTag:customTag.slice(0,4000)};
    }
  }catch{}
  return {...EMPTY_SEARCH_DEFAULTS};
}
export function initialSearchTag(selectedTag:string,customTag:string){return selectedTag==='Personalizado'?customTag.trim():selectedTag==='Ninguno'?'':selectedTag;}
export function newSearchQuery(selectedTag:string,customTag:string){const tag=initialSearchTag(selectedTag,customTag);return tag?tag+' ':'';}
export function replaceInitialSearchTag(query:string,previous:SearchDefaults,next:SearchDefaults){
  let rest=query.trimStart();
  for(const tag of [initialSearchTag(previous.selectedTag,previous.customTag),initialSearchTag(next.selectedTag,next.customTag)]){
    if(tag&&rest.toLowerCase().startsWith(tag.toLowerCase())&&(rest.length===tag.length||/\s/.test(rest[tag.length])))rest=rest.slice(tag.length).trimStart();
  }
  const tag=initialSearchTag(next.selectedTag,next.customTag);
  return tag?tag+' '+rest:rest;
}
const MONTH_CODES=['01ENE','02FEB','03MAR','04ABR','05MAY','06JUN','07JUL','08AGO','09SEP','10OCT','11NOV','12DIC'];
export function currentSearchMonth(now=new Date()){
  const month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Mexico_City',month:'2-digit'}).format(now));
  return MONTH_CODES[month-1];
}
export function effectiveSearchMonth(selection:string,currentMonth:string,query:string){
  // Automatic month is an ordering preference, never an implicit filter.
  return selection==='Actual'?'Todos':selection;
}
