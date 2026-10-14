export class BoundedCache<T> {
 private entries=new Map<string,{value:T;expires:number;bytes:number}>();
 private bytes=0;
 constructor(private maxEntries:number,private maxBytes:number,private ttl:number,private size:(value:T)=>number){}
 private remove(key:string){const item=this.entries.get(key);if(item){this.bytes-=item.bytes;this.entries.delete(key);}}
 private sweep(){const now=Date.now();for(const [key,item] of this.entries)if(item.expires<=now)this.remove(key);}
 get(key:string){this.sweep();const item=this.entries.get(key);if(!item)return undefined;this.entries.delete(key);this.entries.set(key,item);return item.value;}
 set(key:string,value:T){this.sweep();this.remove(key);const bytes=this.size(value);if(!Number.isFinite(bytes)||bytes<0||bytes>this.maxBytes)return this;while(this.entries.size>=this.maxEntries||this.bytes+bytes>this.maxBytes){const oldest=this.entries.keys().next().value;if(oldest===undefined)break;this.remove(oldest);}this.entries.set(key,{value,bytes,expires:Date.now()+this.ttl});this.bytes+=bytes;return this;}
 clear(){this.entries.clear();this.bytes=0;}
 delete(key:string){const exists=this.entries.has(key);this.remove(key);return exists;}
 *values(){this.sweep();for(const item of this.entries.values())yield item.value;}
 *[Symbol.iterator](){this.sweep();for(const [key,item] of this.entries)yield [key,item.value] as [string,T];}
}
