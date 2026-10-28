const CONTROL='input,textarea,select,button,a[href],[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="menu"],[role="menuitem"],[role="listbox"],[role="slider"],[role="spinbutton"],[role="grid"],[data-search-focus-guard]';
export function isSearchTypingKey(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'altKey'|'metaKey'|'isComposing'|'defaultPrevented'>){return !event.defaultPrevented&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.isComposing&&event.key.length===1;}
export function insertSearchText(value:string,text:string,start:number|null,end:number|null){const from=Math.max(0,Math.min(start??value.length,value.length)),to=Math.max(from,Math.min(end??from,value.length));return {value:value.slice(0,from)+text+value.slice(to),caret:from+text.length};}
/** Event-driven focus recovery; no polling, no selecting/clearing the user's query. */
export function installSearchTypingFocus(root:HTMLElement,onInsert:(text:string,input:HTMLInputElement)=>void){
 const doc=root.ownerDocument,win=doc.defaultView!;let idle:ReturnType<typeof setTimeout>|undefined,frame=0;
 const protectedTarget=(target:Element|null)=>!!target?.closest?.(CONTROL)||!!(target as HTMLElement|null)?.isContentEditable;
 const blocked=()=>doc.visibilityState==='hidden'||!!doc.querySelector('dialog[open],[role="dialog"][aria-modal="true"]')||!!win.getSelection()?.toString();
 const input=()=>root.querySelector<HTMLInputElement>('[data-search-query]');
 const focusNeutral=()=>{if(blocked())return;const current=doc.activeElement;if(protectedTarget(current)||current?.closest('[data-search-result]'))return;const field=input();if(field&&!field.disabled&&field.getClientRects().length)field.focus({preventScroll:true});};
 const key=(event:KeyboardEvent)=>{if(!isSearchTypingKey(event)||event.key===' '||blocked()||protectedTarget(event.target as Element)||protectedTarget(doc.activeElement))return;const field=input();if(!field||field.disabled||!field.getClientRects().length)return;event.preventDefault();onInsert(event.key,field);};
 const pointer=(event:PointerEvent)=>{if(protectedTarget(event.target as Element)||(event.target as Element)?.closest('[data-search-result]'))return;win.cancelAnimationFrame(frame);frame=win.requestAnimationFrame(focusNeutral);};
 const clearIdle=()=>{if(idle!==undefined)clearTimeout(idle);};
 const blur=()=>{clearIdle();idle=setTimeout(focusNeutral,10000);};
 const visibility=()=>{if(doc.visibilityState==='visible')focusNeutral();};
 doc.addEventListener('keydown',key);root.addEventListener('pointerup',pointer);doc.addEventListener('focusout',blur);doc.addEventListener('focusin',clearIdle);win.addEventListener('focus',focusNeutral);doc.addEventListener('visibilitychange',visibility);frame=win.requestAnimationFrame(focusNeutral);
 return()=>{clearIdle();win.cancelAnimationFrame(frame);doc.removeEventListener('keydown',key);root.removeEventListener('pointerup',pointer);doc.removeEventListener('focusout',blur);doc.removeEventListener('focusin',clearIdle);win.removeEventListener('focus',focusNeutral);doc.removeEventListener('visibilitychange',visibility);};
}
