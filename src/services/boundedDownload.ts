export async function boundedDownload(response:Response,maxBytes=8*1024*1024):Promise<Buffer>{
 const length=Number(response.headers.get('content-length'));
 if(Number.isFinite(length)&&length>maxBytes){await response.body?.cancel();throw new Error('La vista previa supera 8 MB. Abre el archivo desde Dropbox.');}
 if(!response.body)return Buffer.alloc(0);
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new Error('La vista previa supera 8 MB. Abre el archivo desde Dropbox.');}parts.push(value);}return Buffer.concat(parts,bytes);}finally{reader.releaseLock();}
}
