export type SearchShortcutMode='compatible'|'browser'|'off';
export function searchShortcutMode(value:unknown):SearchShortcutMode{return value==='browser'||value==='off'?value:'compatible';}
export function searchTabCommand(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'altKey'|'metaKey'|'shiftKey'|'repeat'|'isComposing'|'defaultPrevented'>,mode:SearchShortcutMode){
 if(mode==='off'||event.defaultPrevented||event.repeat||event.isComposing||!event.ctrlKey||event.metaKey||event.shiftKey)return null;
 const key=event.key.toLowerCase();if(key!=='t'&&key!=='w')return null;
 if(!event.altKey&&mode!=='browser')return null;
 return key==='t'?'new':'close';
}
/** One scheduled focus per explicit navigation; no polling or query changes. */
export function focusSearchField(root:HTMLElement|null){
 if(!root||root.ownerDocument.visibilityState==='hidden'||root.ownerDocument.querySelector('dialog[open],[role="dialog"][aria-modal="true"]'))return false;
 const input=root.querySelector<HTMLInputElement>('[data-search-query]');if(!input||input.disabled||!input.getClientRects().length)return false;
 input.focus({preventScroll:true});input.setSelectionRange(input.value.length,input.value.length);return true;
}

export function installSearchTabShortcuts(root:HTMLElement,mode:SearchShortcutMode,onCommand:(command:'new'|'close')=>void){
 const doc=root.ownerDocument,win=doc.defaultView!;
 const key=(event:KeyboardEvent)=>{
  if(doc.visibilityState==='hidden'||event.getModifierState?.('AltGraph')||doc.querySelector('dialog[open],[role="dialog"][aria-modal="true"]'))return;
  const target=event.target as HTMLElement|null;if(target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')&&!target.matches('[data-search-query]'))return;
  if(target&&target!==doc.body&&!root.contains(target))return;
  const command=searchTabCommand(event,mode);if(!command)return;event.preventDefault();event.stopPropagation();onCommand(command);
 };win.addEventListener('keydown',key);return()=>win.removeEventListener('keydown',key);
}
export function closeSearchTab<T extends {id:string;query:string;canClose:boolean}>(tabs:T[],activeId:string,id:string){
 if(tabs.length<=1||!tabs.find(tab=>tab.id===id)?.canClose)return {tabs,activeId};
 const next=tabs.filter(tab=>tab.id!==id);return {tabs:next,activeId:activeId===id?next[Math.min(tabs.findIndex(tab=>tab.id===id),next.length-1)].id:activeId};
}
