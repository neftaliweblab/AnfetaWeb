export function activityFinancialFields(page:any){
 return Object.entries(page.properties||{}).flatMap(([name,p]:any)=>{
  const key=name.normalize('NFD').replace(/\p{M}/gu,'');
  if(!/utilidad|ganancia|perdida|profit|margen/i.test(key))return [];
  const value=p.type==='number'?p.number:p.type==='formula'&&p.formula?.type==='number'?p.formula.number:p.type==='rollup'&&p.rollup?.type==='number'?p.rollup.number:null;
  return typeof value==='number'&&Number.isFinite(value)?[{name,value}]:[];
 });
}
