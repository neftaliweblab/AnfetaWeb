import type {NotionCalendarActivity} from '@/types/anfeta';
export function ReturnedObservations({activity}:{activity:NotionCalendarActivity}){
 const flow=activity.reviewFlow;if(!flow||!['returned','handoff'].includes(flow.State)||!flow.Note)return null;
 const images=Array.isArray(flow.Attachments)?flow.Attachments:[];
 return <aside className="space-y-2 rounded-xl border border-amber-500/60 bg-amber-950/30 p-3 text-xs text-amber-100"><strong className="text-amber-300">↩ Observaciones para continuar</strong><p className="whitespace-pre-wrap leading-relaxed">{String(flow.Note)}</p>{images.map((image:any,index:number)=>image.BlockId?<a key={index} href={'/api/data?type=image-proxy&blockId='+encodeURIComponent(image.BlockId)} target="_blank" rel="noreferrer"><img loading="lazy" src={'/api/data?type=image-proxy&blockId='+encodeURIComponent(image.BlockId)} alt={image.Name||'Observación'} className="max-h-64 w-full rounded border border-amber-800 object-contain"/></a>:null)}</aside>;
}
