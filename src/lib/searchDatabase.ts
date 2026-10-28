/** Database metadata from the indexed row; never infer a database from task title words. */
export function searchDatabaseName(item:any){
 const source=String(item?.source??'').toLowerCase();
 if(source==='dropbox'||source==='1'||String(item?.sourceName||'').toLowerCase()==='dropbox')return '';
 return String(item?.sourceName||item?.externalSourceName||item?.ExternalSourceName||'').trim();
}
export function searchDatabaseOptions(items:readonly any[]){
 const names=new Map<string,string>();
 for(const item of items){const name=searchDatabaseName(item);if(name&&!names.has(name.toLocaleLowerCase('es')))names.set(name.toLocaleLowerCase('es'),name);}
 return [...names.values()].sort((a,b)=>a.localeCompare(b,'es')).map(name=>({value:'base:'+name,label:name}));
}
export function matchesSearchDatabase(item:any,value:string){return searchDatabaseName(item).toLocaleLowerCase('es')===value.slice(5).trim().toLocaleLowerCase('es');}
