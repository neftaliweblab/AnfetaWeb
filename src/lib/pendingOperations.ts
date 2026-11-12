export type PendingOperation={key:string;id?:string;item?:any;patch?:any;patches?:Array<{id:string;patch:any}>;remove?:string[];reorder?:string[]};
export function applyPendingOperation(items:any[],op:PendingOperation){
 if(op.reorder){
   const map = new Map(items.map(item => [item.id, item]));
   const reordered: any[] = [];
   for (const id of op.reorder) {
     const it = map.get(id);
     if (it) {
       reordered.push(it);
       map.delete(id);
     }
   }
   return [...reordered, ...map.values()];
 }
 if(op.remove)return items.filter(item=>!op.remove!.includes(item.id));
 if(op.item)return items.some(item=>item.id===op.item.id)?items: [op.item,...items];
 if(op.patches?.length){
   const byId=new Map(op.patches.map(entry=>[entry.id,entry.patch]));
   return items.map(item=>{const p=byId.get(item.id);return p?{...item,...p,id:item.id}:item;});
 }
 return items.map(item=>item.id===op.id?{...item,...op.patch,id:item.id}:item);
}
export function applyPendingJournal(items:any[],ops:PendingOperation[]){return ops.reduce(applyPendingOperation,items);}
