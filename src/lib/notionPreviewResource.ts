import {readApiJson} from './readApiJson';
import { getModalPositionConfig } from './modalPosition';

export interface PreviewData {blocks:any[];content:string}
const cache=new Map<string,{at:number;value:PreviewData}>();
export function previewPageId(item:any):string {
 for(const raw of [item?.externalId,item?.id,item?.target,item?.externalUrl]){
  const value=String(raw||'');
  const match=value.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|(?<![a-f0-9])[a-f0-9]{32}(?![a-f0-9])/i);
  if(match)return match[0].replace(/-/g,'').toLowerCase();
 }
 return '';
}
export function invalidateNotionPreview(id:string){cache.delete(id.replace(/-/g,'').toLowerCase());}
export async function loadNotionPreview(id:string,signal:AbortSignal):Promise<PreviewData>{
 const key=id.replace(/-/g,'').toLowerCase();
 if(!/^[a-f0-9]{32}$/.test(key))throw Error('Página de Notion inválida.');
 signal.throwIfAborted();
 const saved=cache.get(key);
 if(saved&&Date.now()-saved.at<15000)return saved.value;
 const data=await fetch('/api/data?type=page-preview&pageId='+key,{signal,cache:'no-store'}).then(readApiJson);
 signal.throwIfAborted();
 const value={blocks:Array.isArray(data.blocks)?data.blocks:[],content:String(data.content||'')};
 if(cache.size>=100)cache.delete(cache.keys().next().value!);
 cache.set(key,{at:Date.now(),value});return value;
}
export function hoverPreviewBounds(anchor:{left:number;top:number;bottom:number},width:number,height:number,positionOverride?:string){
 const margin=12,gap=8,w=Math.max(1,Math.min(800,width-margin*2));
 const config = getModalPositionConfig();
 const mode = positionOverride || config.mode;
 const topOffset = config.topOffset;

 if (mode === 'top_high' || mode === 'muy_arriba' || mode === 'top' || mode === 'arriba' || mode === 'custom') {
   const top = topOffset;
   const h = Math.max(1, Math.min(650, height - top - margin));
   return { left: Math.max(margin, Math.min(anchor.left, width - w - margin)), top, width: w, height: h };
 }

 const below=Math.max(0,height-margin-anchor.bottom-gap),above=Math.max(0,anchor.top-margin-gap);
 const placeAbove=below<320&&above>below;
 const available=placeAbove?above:below;
 const h=Math.max(1,Math.min(620,available||height-margin*2));
 return {left:Math.max(margin,Math.min(anchor.left,width-w-margin)),top:Math.max(margin,Math.min(placeAbove?anchor.top-gap-h:anchor.bottom+gap,height-h-margin)),width:w,height:h};
}
