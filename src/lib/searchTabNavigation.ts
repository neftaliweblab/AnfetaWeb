export type SearchShortcutMode='compatible'|'alternative'|'custom'|'off';
export type SearchShortcutBindings={new:string;close:string};
export const DEFAULT_SEARCH_BINDINGS:SearchShortcutBindings={new:'Ctrl+Alt+T',close:'Ctrl+Alt+W'};
export function searchShortcutMode(value:unknown):SearchShortcutMode{return value==='off'||value==='alternative'||value==='custom'?value:'compatible';}
export function shortcutFromEvent(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'altKey'|'metaKey'|'shiftKey'>){
 const key=event.key.length===1?event.key.toUpperCase():event.key;
 if(!/^[A-Z0-9]$|^F(?:[1-9]|1[0-2])$/.test(key))return '';
 return [event.ctrlKey?'Ctrl':'',event.altKey?'Alt':'',event.metaKey?'Meta':'',event.shiftKey?'Shift':'',key].filter(Boolean).join('+');
}
export function shortcutProblem(value:string){
 if(!/^(?:(?:Ctrl|Alt|Meta|Shift)\+)+(?:[A-Z0-9]|F(?:[1-9]|1[0-2]))$/.test(value)||!/(?:Ctrl|Alt|Meta)\+/.test(value))return 'Usa Ctrl, Alt o Meta junto con una letra, número o tecla F.';
 if(/^(?:Ctrl|Meta)\+(?:[TWNLRPSFHDJKOU]|[1-9]|F4|F5)$/.test(value)||/^(?:Ctrl|Meta)\+Shift\+[TWNP]$/.test(value)||/^Alt\+F4$/.test(value)||value==='Ctrl+Alt+B')return 'Esa combinación está reservada por el navegador, el sistema o el acceso principal de ANFETA.';
 return '';
}
export function readSearchBindings(raw:unknown):SearchShortcutBindings{
 const value=raw&&typeof raw==='object'?raw as SearchShortcutBindings:DEFAULT_SEARCH_BINDINGS;
 if(typeof value.new!=='string'||typeof value.close!=='string'||shortcutProblem(value.new)||shortcutProblem(value.close)||value.new===value.close)return {...DEFAULT_SEARCH_BINDINGS};
 return {new:value.new,close:value.close};
}
export function effectiveSearchBindings(mode:SearchShortcutMode,custom?:SearchShortcutBindings){return mode==='alternative'?{new:'Alt+Shift+T',close:'Alt+Shift+W'}:mode==='custom'?readSearchBindings(custom):DEFAULT_SEARCH_BINDINGS;}
export function searchTabCommand(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'altKey'|'metaKey'|'shiftKey'|'repeat'|'isComposing'|'defaultPrevented'>,mode:SearchShortcutMode,custom?:SearchShortcutBindings){
 if(mode==='off'||event.defaultPrevented||event.repeat||event.isComposing)return null;
 const combo=shortcutFromEvent(event),bindings=effectiveSearchBindings(mode,custom);
 return combo===bindings.new?'new':combo===bindings.close?'close':null;
}
/** One scheduled focus per explicit navigation; no polling or query changes. */
export function focusSearchField(root:HTMLElement|null){
 if(!root||root.ownerDocument.visibilityState==='hidden'||root.ownerDocument.querySelector('dialog[open],[role="dialog"][aria-modal="true"]'))return false;
 const input=root.querySelector<HTMLInputElement>('[data-search-query]');if(!input||input.disabled||!input.getClientRects().length)return false;
 input.focus({preventScroll:true});input.setSelectionRange(input.value.length,input.value.length);return true;
}

export function installSearchTabShortcuts(root:HTMLElement,mode:SearchShortcutMode,onCommand:(command:'new'|'close')=>void,bindings?:SearchShortcutBindings){
 const doc=root.ownerDocument,win=doc.defaultView!;
 const key=(event:KeyboardEvent)=>{
  if(doc.visibilityState==='hidden'||event.getModifierState?.('AltGraph')||doc.querySelector('dialog[open],[role="dialog"][aria-modal="true"]'))return;
  const target=event.target as HTMLElement|null;if(target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')&&!target.matches('[data-search-query]'))return;
  if(target&&target!==doc.body&&!root.contains(target))return;
  const command=searchTabCommand(event,mode,bindings);if(!command)return;event.preventDefault();event.stopPropagation();onCommand(command);
 };win.addEventListener('keydown',key);return()=>win.removeEventListener('keydown',key);
}
export function closeSearchTab<T extends {id:string;query:string;canClose:boolean}>(tabs:T[],activeId:string,id:string){
 if(tabs.length<=1||!tabs.find(tab=>tab.id===id)?.canClose)return {tabs,activeId};
 const next=tabs.filter(tab=>tab.id!==id);return {tabs:next,activeId:activeId===id?next[Math.min(tabs.findIndex(tab=>tab.id===id),next.length-1)].id:activeId};
}
