export const EDITABLE_NOTION_TEXT_TYPES=['paragraph','heading_1','heading_2','heading_3','bulleted_list_item','numbered_list_item','to_do','quote','callout','code'];
export function newTextBlock(input:any){
 if(!EDITABLE_NOTION_TEXT_TYPES.includes(input?.type)||typeof input.text!=='string'||!input.text.trim()||input.text.length>4000)throw new Error('Selecciona un tipo compatible y escribe entre 1 y 4000 caracteres.');
 if(/\[anfeta_|datos internos de anfeta/i.test(input.text))throw new Error('Los identificadores internos de ANFETA están reservados.');
 const annotations:Record<string,boolean>={};
 for(const key of ['bold','italic','strikethrough','underline','code']){
  if(input.annotations?.[key]!==undefined&&typeof input.annotations[key]!=='boolean')throw new Error('Formato inválido.');
  annotations[key]=input.annotations?.[key]===true;
 }
 const rich_text=[];
 for(let start=0;start<input.text.length;){let end=Math.min(start+2000,input.text.length);if(end<input.text.length&&/[\uD800-\uDBFF]/.test(input.text[end-1]))end--;rich_text.push({type:'text',text:{content:input.text.slice(start,end)},annotations});start=end;}
 const payload:any={rich_text};
 if(input.type==='to_do')payload.checked=false;
 if(input.type==='code')payload.language='plain text';
 if(input.type==='callout')payload.icon={type:'emoji',emoji:'💡'};
 return {object:'block',type:input.type,[input.type]:payload};
}
export function blockTextRuns(block:any){
 if(!EDITABLE_NOTION_TEXT_TYPES.includes(block?.type))throw new Error('Este tipo de bloque todavía no tiene editor.');
 const runs=block[block.type]?.rich_text;
 if(!Array.isArray(runs)||runs.length>100)throw new Error('Formato del bloque no compatible.');
 return runs.length?runs:[{type:'text',text:{content:''}}];
}
export function textRunValue(run:any){return run.type==='text'?run.text?.content||'':run.plain_text||run.equation?.expression||'';}
export function blockTextUpdate(block:any,texts:unknown){
 const runs=blockTextRuns(block);
 if(!Array.isArray(texts)||texts.length!==runs.length||texts.some(t=>typeof t!=='string'||t.length>2000))throw new Error('Cada fragmento admite hasta 2000 caracteres; conserva la cantidad de fragmentos.');
 const rich_text=runs.map((run:any,index:number)=>{
  if(run.type==='text')return {type:'text',text:{content:texts[index],...(run.text?.link?{link:run.text.link}:{})},...(run.annotations?{annotations:run.annotations}:{})};
  if(texts[index]!==textRunValue(run))throw new Error('Las menciones y ecuaciones se conservan sin modificar.');
  if(!['mention','equation'].includes(run.type))throw new Error('Fragmento no compatible.');
  return {type:run.type,[run.type]:run[run.type],...(run.annotations?{annotations:run.annotations}:{})};
 });
 if(/\[anfeta_|datos internos de anfeta/i.test(rich_text.map(textRunValue).join('')))throw new Error('Los identificadores internos de ANFETA están reservados.');
 return {[block.type]:{rich_text}};
}
