export function viewportPosition(point:{x:number;y:number},size:{width:number;height:number},viewport:{width:number;height:number}){
  return {x:Math.max(8,Math.min(point.x,viewport.width-size.width-8)),y:Math.max(8,Math.min(point.y,viewport.height-size.height-8))};
}
