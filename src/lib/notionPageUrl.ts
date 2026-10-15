export function notionPageUrl(record:any):string{
  if(!record)return '';
  for(const value of [record.pageUrl,record.PageUrl,record.externalUrl,record.ExternalUrl,record.url]){
    if(typeof value!=='string')continue;
    try{const url=new URL(value.replace(/^notion:/,'https:'));if(['https:','http:'].includes(url.protocol)&&url.pathname!=='/'&&/(^|\.)notion\.(so|com|site)$/i.test(url.hostname))return url.href;}catch{}
  }
  for(const value of [record.originalPageId,record.pageId,record.PageId,record.externalId,record.ExternalId,record.id]){
    if(typeof value!=='string')continue;
    const id=value.replace(/^review-mirror-/,'').replace(/^notion[:\-]/i,'').replace(/-/g,'');
    if(/^[a-f0-9]{32}$/i.test(id))return 'https://www.notion.so/'+id;
  }
  return '';
}
