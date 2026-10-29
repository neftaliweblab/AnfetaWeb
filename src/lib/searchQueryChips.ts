/** Top-level operands stay intact: quoted phrases and groups are never split. */
export function queryChips(query:string){
 const tokens:{text:string;start:number;end:number}[]=[];
 let start=-1,depth=0,quoted=false;
 for(let i=0;i<=query.length;i++){
  const c=query[i]||' ';
  if(c==='"'&&query[i-1]!=='\\')quoted=!quoted;
  if(!quoted){if(c==='(')depth++;if(c===')')depth--;}
  if(depth<0)return [];
  if(!quoted&&depth===0&&/\s/.test(c)){
   if(start>=0){tokens.push({text:query.slice(start,i),start,end:i});start=-1;}
  }else if(start<0)start=i;
 }
 if(depth||quoted)return [];
 const operator=(text:string)=>/^(AND|OR|&&|\|\|)$/i.test(text);
 const chips=[];
 for(let i=0;i<tokens.length;i++){
  let token=tokens[i];if(operator(token.text))continue;
  if(/^NOT$/i.test(token.text)&&tokens[i+1]){const next=tokens[++i];token={text:query.slice(token.start,next.end),start:token.start,end:next.end};}
  else if(/^NOT$/i.test(token.text))return [];
  const previous=tokens.findLast(t=>t.end<=token.start&&operator(t.text));
  const following=tokens.find(t=>t.start>=token.end&&operator(t.text));
  const adjacentPrevious=previous&&query.slice(previous.end,token.start).trim()==='';
  const adjacentNext=following&&query.slice(token.end,following.start).trim()==='';
  const from=adjacentPrevious?previous.start:token.start,to=!adjacentPrevious&&adjacentNext?following.end:token.end;
  chips.push({...token,without:(query.slice(0,from)+' '+query.slice(to)).trim()});
 }
 return chips;
}
export function appendQueryTerm(query:string,value:string,mode:'include'|'exclude'|'any'){
 const clean=value.trim();if(!clean)return query;
 const term='"'+clean.replace(/"/g,'')+'"',base=query.trim();
 if(!base)return mode==='exclude'?'NOT '+term:term;
 return '('+base+') '+(mode==='any'?'OR ':mode==='exclude'?'AND NOT ':'AND ')+term;
}
