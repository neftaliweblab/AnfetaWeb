"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import {searchShortcutMode,installSearchTabShortcuts,readSearchBindings,DEFAULT_SEARCH_BINDINGS,effectiveSearchBindings,type SearchShortcutBindings,type SearchShortcutMode} from '@/lib/searchTabNavigation';
export function useSearchTabShortcuts({root,active,owner,onNew,onClose}:{root:RefObject<HTMLDivElement|null>;active:boolean;owner:string;onNew:()=>void;onClose:()=>void}){
 const [setting,setSetting]=useState<{owner:string;mode:SearchShortcutMode;bindings:SearchShortcutBindings}>({owner:'',mode:'compatible',bindings:DEFAULT_SEARCH_BINDINGS});
 const mode=setting.owner===owner?setting.mode:'compatible',bindings=setting.owner===owner?setting.bindings:DEFAULT_SEARCH_BINDINGS;
 const handlers=useRef({onNew,onClose});handlers.current={onNew,onClose};
 useEffect(()=>{let mode:SearchShortcutMode='compatible',bindings=DEFAULT_SEARCH_BINDINGS;try{mode=searchShortcutMode(localStorage.getItem('anfeta-search-tab-shortcuts:'+owner));bindings=readSearchBindings(JSON.parse(localStorage.getItem('anfeta-search-tab-bindings:'+owner)||'null'));}catch{}setSetting({owner,mode,bindings});},[owner]);
 const setMode=(mode:SearchShortcutMode)=>{setSetting({owner,mode,bindings});try{localStorage.setItem('anfeta-search-tab-shortcuts:'+owner,mode);}catch{}};
 const setBindings=(value:SearchShortcutBindings)=>{const next=readSearchBindings(value);setSetting({owner,mode:'custom',bindings:next});try{localStorage.setItem('anfeta-search-tab-bindings:'+owner,JSON.stringify(next));localStorage.setItem('anfeta-search-tab-shortcuts:'+owner,'custom');}catch{}};
 useEffect(()=>{if(!active||!root.current)return;return installSearchTabShortcuts(root.current,mode,command=>{if(command==='new')handlers.current.onNew();else handlers.current.onClose();},bindings);},[active,mode,root,bindings]);
 return {mode,setMode,bindings,setBindings,effectiveBindings:effectiveSearchBindings(mode,bindings)};
}
