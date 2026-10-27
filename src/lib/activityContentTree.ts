export type ActivityContentNode={block:any;children:ActivityContentNode[];key:string};
export function activityContentTree(blocks:any[]){
 const roots:ActivityContentNode[]=[],stack:ActivityContentNode[]=[];
 for(const [index,block] of blocks.entries()){
  const node={block,children:[],key:String(block.id||'block')+':'+index};
  while(stack.length&&((stack[stack.length-1].block.depth||0)>=(block.depth||0)||!stack[stack.length-1].block.hasChildren))stack.pop();
  if(stack.length)stack[stack.length-1].children.push(node);else roots.push(node);
  stack.push(node);
 }
 return roots;
}
