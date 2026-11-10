export type OperationalState='pending'|'review'|'completed'|'suspended'|'unknown';
export const PROGRESSIVE_WORKFLOW_PRIMARY=process.env.NEXT_PUBLIC_ANFETA_LEGACY_WORKFLOW!=='1';
const phases={
 saprtuz:{state:'suspended',label:'Suspendida',financial:'unknown'},
 aaprtuz:{state:'suspended',label:'Suspendida',financial:'unknown'},
 aartuz:{state:'suspended',label:'Suspendida',financial:'unknown'},
 aapr:{state:'suspended',label:'Suspendida',financial:'unknown'},
 aprtuz:{state:'pending',label:'Por asignar',financial:'unknown'},
 prtuz:{state:'pending',label:'Por hacer',financial:'unknown'},
 rtuz:{state:'review',label:'Por revisar',financial:'unknown'},
 tuz:{state:'completed',label:'Terminada · aprobada',financial:'unknown'},
 uz:{state:'completed',label:'Terminada · cobro/pago pendiente',financial:'pending'},
 z:{state:'completed',label:'Cerrada · cobrada/pagada',financial:'settled'},
} as const;
export function progressiveStage(text:string){
 const match=(text||'').match(/(?<![\p{L}\p{N}_@.\/-])(saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|rtuz|tuz|uz|z)(?:dominio|domi|[rRsSdDcCbBpP])?(?![\p{L}\p{N}_@.\/-])/iu);
 if(match){
   const key=match[1].toLowerCase() as keyof typeof phases;
   const rawSuffix=(match[0].slice(match[1].length)||'').toLowerCase();
   const isDominio=rawSuffix==='d'||rawSuffix.startsWith('domi');
   const isCobro=rawSuffix==='c'||rawSuffix.startsWith('cob');
   const isPago=rawSuffix==='p'||rawSuffix.startsWith('pag');
   const suffix=isDominio?'D':isCobro?'C':isPago?'P':rawSuffix.toUpperCase();
   const category=isDominio?'dominio':isCobro?'cobro':isPago?'pago':suffix==='S'?'software':'revision';
   return {code:key+suffix,category,...phases[key],token:match[0],index:match.index!};
 }
 const wa=(text||'').match(/(?<![\p{L}\p{N}_@.\/-])(AA)(?![\p{L}\p{N}_@.\/-])/u);
 if(wa){return {code:wa[1],category:'revision',state:'suspended' as const,label:'Suspendida',financial:'unknown' as const,token:wa[0],index:wa.index!};}
 const other=(text||'').match(/(?<![\p{L}\p{N}_@.\/-])z([scpd])(?![\p{L}\p{N}_@.\/-])/iu);
 if(other){
   const catKey=other[1].toLowerCase();
   const category=catKey==='d'?'dominio':catKey==='s'?'software':catKey==='c'?'cobro':'pago';
   return {code:'Z'+other[1].toUpperCase(),category,state:'completed' as const,label:category==='dominio'?'Dominio terminado':category==='software'?'Software terminado':category==='cobro'?'Cobro terminado':'Pago terminado',financial:'unknown' as const,token:other[0],index:other.index!};
 }

 // Reconocimiento explícito de opciones textuales de Notion para diferenciar FIN vs TERMINADO
 const clean = (text || '').trim();
 if (clean) {
   if (/(?<![\p{L}\p{N}_])(?:finalizad[oa]|z\s*-\s*cobrado|cobro\/documentacion|zrevision|\bfin\b)(?![\p{L}\p{N}_])/iu.test(clean)) {
     return { code: 'zR', category: 'revision' as const, state: 'completed' as const, label: 'Finalizada (Fin)', financial: 'settled' as const, token: clean, index: 0 };
   }
   if (/(?<![\p{L}\p{N}_])(?:terminad[oa]\s+rev|terminad[oa]|completad[oa])(?![\p{L}\p{N}_])/iu.test(clean)) {
     return { code: 'tuzR', category: 'revision' as const, state: 'completed' as const, label: 'Terminada · por aprobar', financial: 'unknown' as const, token: clean, index: 0 };
   }
   if (/(?<![\p{L}\p{N}_])(?:revisar\s+revisiones|en\s+revisi[oó]n|revisi[oó]n)(?![\p{L}\p{N}_])/iu.test(clean)) {
     return { code: 'rtuzR', category: 'revision' as const, state: 'review' as const, label: 'Por revisar', financial: 'unknown' as const, token: clean, index: 0 };
   }
   if (/(?<![\p{L}\p{N}_])(?:por\s+hacer|sin\s+iniciar)(?![\p{L}\p{N}_])/iu.test(clean)) {
     return { code: 'prtuzR', category: 'revision' as const, state: 'pending' as const, label: 'Por hacer', financial: 'unknown' as const, token: clean, index: 0 };
   }
   if (/(?<![\p{L}\p{N}_])(?:por\s+asignar|arrancar\s+asignar)(?![\p{L}\p{N}_])/iu.test(clean)) {
     return { code: 'aprtuzR', category: 'revision' as const, state: 'pending' as const, label: 'Por asignar', financial: 'unknown' as const, token: clean, index: 0 };
   }
   if (/(?<![\p{L}\p{N}_])(?:suspendid[oa]s?)(?![\p{L}\p{N}_])/iu.test(clean)) {
     return { code: 'saprtuzR', category: 'revision' as const, state: 'suspended' as const, label: 'Suspendida', financial: 'unknown' as const, token: clean, index: 0 };
   }
 }

 return null;
}
export function stripProgressiveStage(title:string){const stage=progressiveStage(title);return stage?title.slice(0,stage.index)+title.slice(stage.index+stage.token.length):title;}

export function revisionPhaseTitle(title:string,state:'pending'|'suspended'|'review'|'completed'|'finalized'|'fin',assign=false){
 const stage=progressiveStage(title);
 const isDominio=stage?.category==='dominio'||/(?<![\p{L}\p{N}_@.\/-])(?:aprtuzDominio|prtuzDominio|aprtuzD|prtuzD)(?![\p{L}\p{N}_@.\/-])/iu.test(title);
 const body=(stage?stripProgressiveStage(title):title)
   .replace(/(?<![\p{L}\p{N}_@.\/-])(?:saprtuzREVISION|sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|tuzREVISION|uzREVISION|zREVISION|saprtuzDominio|aprtuzDominio|prtuzDominio|rtuzDominio|tuzDominio)(?![\p{L}\p{N}_@.\/-])/giu,' ')
   .replace(/\s+/g,' ')
   .trim();
 const isFin = state === 'finalized' || state === 'fin';
 const domMap: Record<string, string> = { pending: assign ? 'aprtuzD' : 'prtuzD', suspended: 'saprtuzD', review: 'rtuzD', completed: 'tuzD' };
 const revMap: Record<string, string> = { pending: assign ? 'aprtuzR' : 'prtuzR', suspended: 'saprtuzR', review: 'rtuzR', completed: 'tuzR' };
 const legRevMap: Record<string, string> = { pending: 'prtuzREVISION', suspended: 'sprtuzREVISION', review: 'rtuzREVISION', completed: 'zREVISION' };
 const prefix = PROGRESSIVE_WORKFLOW_PRIMARY
   ? (isDominio ? (isFin ? 'zD' : (domMap[state] || 'tuzD')) : (isFin ? 'zR' : (revMap[state] || 'tuzR')))
   : (isDominio ? (isFin ? 'zD' : (domMap[state] || 'tuzD')) : (isFin ? 'zREVISION' : (legRevMap[state] || 'zREVISION')));
 return prefix + ' ' + body;
}
