export function sameInstant(a:unknown,b:unknown){
  if(a===b)return true;
  const left=Date.parse(String(a||'')),right=Date.parse(String(b||''));
  return Number.isFinite(left)&&Number.isFinite(right)&&left===right;
}
