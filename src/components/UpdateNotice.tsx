"use client";
import {useEffect} from 'react';
import {recordAppLog} from '@/lib/appDiagnostics';
export function UpdateNotice({message,owner}:{message:string;owner:string}){
 useEffect(()=>{if(!message)return;for(const text of new Set(message.split(' · ').map(value=>value.trim()).filter(Boolean)))recordAppLog(owner,'Calendario · actualización',text);},[message,owner]);
 return null;
}
