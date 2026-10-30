"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import {searchShortcutMode,installSearchTabShortcuts,type SearchShortcutMode} from '@/lib/searchTabNavigation';
export function useSearchTabShortcuts({root,active,owner,onNew,onClose}:{root:RefObject<HTMLDivElement|null>;active:boolean;owner:string;onNew:()=>void;onClose:()=>void}){
 const [setting,setSetting]=useState<{owner:string;mode:SearchShortcutMode}>({owner:'',mode:'compatible'});
 const mode=setting.owner===owner?setting.mode:'compatible';const handlers=useRef({onNew,onClose});handlers.current={onNew,onClose};
 useEffect(()=>{let mode:SearchShortcutMode='compatible';try{mode=searchShortcutMode(localStorage.getItem('anfeta-search-tab-shortcuts:'+owner));}catch{}setSetting({owner,mode});},[owner]);
 const setMode=(mode:SearchShortcutMode)=>{setSetting({owner,mode});try{localStorage.setItem('anfeta-search-tab-shortcuts:'+owner,mode);}catch{}};
 useEffect(()=>{if(!active||!root.current)return;return installSearchTabShortcuts(root.current,mode,command=>{if(command==='new')handlers.current.onNew();else handlers.current.onClose();});},[active,mode,root]);
 return {mode,setMode};
}
