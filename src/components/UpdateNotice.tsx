"use client";
import {useEffect,useState} from 'react';
export function UpdateNotice({message}:{message:string}){
 const [saved,setSaved]=useState(''),[dismissed,setDismissed]=useState(false);
 useEffect(()=>{if(message&&message!==saved){setSaved(message);setDismissed(false);}},[message,saved]);
 if(!saved||dismissed)return null;
 const messages=[...new Set(saved.split(' · ').map(text=>text.trim()).filter(Boolean))];
 return <div className="flex items-start gap-2 border-b border-amber-900/40 bg-amber-950/20 px-3 py-1 text-xs text-amber-200"><details className="min-w-0 flex-1"><summary className="cursor-pointer">Actualización con avisos · Ver detalles ({messages.length})</summary><ul className="mt-2 max-h-36 overflow-y-auto space-y-1 break-words">{messages.map((text,index)=><li key={index}>{text}</li>)}</ul></details><button type="button" aria-label="Cerrar aviso de actualización" onClick={()=>setDismissed(true)}>×</button></div>;
}
