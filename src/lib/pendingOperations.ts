export type PendingOperation={key:string;id?:string;item?:any;patch?:any;remove?:string[]};
export function applyPendingOperation(items:any[],op:PendingOperation){
 if(op.remove)return items.filter(item=>!op.remove!.includes(item.id));
 if(op.item)return items.some(item=>item.id===op.item.id)?items: [op.item,...items];
 return items.map(item=>item.id===op.id?{...item,...op.patch,id:item.id}:item);
}
export function applyPendingJournal(items:any[],ops:PendingOperation[]){return ops.reduce(applyPendingOperation,items);}
