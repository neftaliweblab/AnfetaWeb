import type {NotionCalendarActivity,SearchResultRow} from '../types/anfeta';
export function activityLinkPageId(value:unknown){
 const id=String(value||'').trim().replace(/-/g,'').toLowerCase();
 return /^[a-f0-9]{32}$/.test(id)?id:'';
}
/** A live page stays visible even while an older search index is loading. */
export function directActivitySearchRow(activity:NotionCalendarActivity,indexed?:SearchResultRow):SearchResultRow{
 const aiContent = activity.aiContent || (activity as any)['busqueda palabras por contenido pagina IA'] || indexed?.aiContent || indexed?.['busqueda palabras por contenido pagina IA'] || '';
 const row:SearchResultRow={id:activity.pageId,externalId:activity.pageId,name:activity.title,
   source:'Notion',sourceName:'Notion',type:'PAGE',folder:'',extension:'',sizeBytes:0,modifiedLocalDate:'',
   path:activity.pageUrl||'https://notion.so/'+activityLinkPageId(activity.pageId),target:activity.pageUrl,
   scheduledDate:activity.start,scheduledEnd:activity.end,updateStatus:activity.status,assignedPerson:activity.person,
   domain:activity.domain,isFolder:false,serverModified:activity.serverModified,
   aiContent: aiContent || undefined,
   'busqueda palabras por contenido pagina IA': aiContent || undefined,
   contentSnippet: (activity.contentSnippet || indexed?.contentSnippet || aiContent || '').slice(0, 300),
   pageContent: activity.pageContent || indexed?.pageContent || aiContent || '',
 };
 if(!indexed||activityLinkPageId(indexed.externalId||indexed.id)!==activityLinkPageId(activity.pageId))return row;
 const liveTime=Date.parse(activity.serverModified||''),indexTime=Date.parse(indexed.serverModified||'');
 if(Number.isFinite(liveTime)&&(!Number.isFinite(indexTime)||liveTime>indexTime))return {...indexed,...row, aiContent: aiContent || indexed.aiContent, 'busqueda palabras por contenido pagina IA': aiContent || indexed['busqueda palabras por contenido pagina IA']};
 return {...row,...indexed,id:row.id,externalId:row.externalId, aiContent: aiContent || indexed.aiContent, 'busqueda palabras por contenido pagina IA': aiContent || indexed['busqueda palabras por contenido pagina IA']};
}
