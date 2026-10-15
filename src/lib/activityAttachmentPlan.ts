export function activityAttachmentPlan(target:{id?:string;externalId?:string;name?:string}|null|undefined,filename:string){
 const pageId=String(target?.externalId||target?.id||'').replace(/-/g,'');
 if(!/^[a-f0-9]{32}$/i.test(pageId))return null;
 return {pageId,title:filename.replace(/\.[a-z0-9]{1,12}$/i,''),customFolder:'/DRX/Grabaciones/'+pageId};
}
