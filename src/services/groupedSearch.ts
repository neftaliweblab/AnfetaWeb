export type SearchExpression = {kind:'term';value:string;exact:boolean}|{kind:'not';child:SearchExpression}|{kind:'and'|'or';left:SearchExpression;right:SearchExpression};
/** Bounded expression tree; no expansion into exponentially many OR clauses. */
export function groupedSearch(input:string):SearchExpression|undefined{
 if(!input.includes('('))return;
 const tokens=[...input.matchAll(/[a-zA-Z]+:"[^"]*"|"[^"]*"|[()]|[^\s()]+/g)].map(m=>m[0]);
 if(tokens.length>512)return;
 let position=0,depth=0;
 const isOr=(token:string)=>/^(?:OR|\|\||\|)$/i.test(token||'');
 const isAnd=(token:string)=>/^(?:AND|&&|&|\+)$/i.test(token||'');
 const unary=():SearchExpression=>{
  if(++depth>64)throw Error('Depth');
  try{
   const token=tokens[position++];if(!token)throw Error('Missing operand');
   if(/^(?:NOT|!)$/i.test(token))return {kind:'not',child:unary()};
   if(token==='('){const node=or();if(tokens[position++]!==')')throw Error('Unclosed group');return node;}
   if(token===')'||isOr(token)||isAnd(token))throw Error('Unexpected operator');
   const exact=token.startsWith('"')&&token.endsWith('"');
   if(!exact&&/^[-!].+/.test(token))return {kind:'not',child:{kind:'term',value:token.slice(1),exact:false}};
   return {kind:'term',value:exact?token.slice(1,-1):token,exact};
  }finally{depth--;}
 };
 const and=():SearchExpression=>{let node=unary();while(position<tokens.length&&tokens[position]!==')'&&!isOr(tokens[position])){if(isAnd(tokens[position]))position++;node={kind:'and',left:node,right:unary()};}return node;};
 const or=():SearchExpression=>{let node=and();while(isOr(tokens[position])){position++;node={kind:'or',left:node,right:and()};}return node;};
 try{const node=or();return position===tokens.length?node:undefined;}catch{return;}
}
export function evaluateGroupedSearch(node:SearchExpression,term:(value:string,exact:boolean)=>boolean):boolean{
 switch(node.kind){case 'term':return term(node.value,node.exact);case 'not':return !evaluateGroupedSearch(node.child,term);case 'and':return evaluateGroupedSearch(node.left,term)&&evaluateGroupedSearch(node.right,term);case 'or':return evaluateGroupedSearch(node.left,term)||evaluateGroupedSearch(node.right,term);}
}
