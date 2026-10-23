export type OperationalState='pending'|'review'|'completed'|'suspended'|'unknown';
export const PROGRESSIVE_WORKFLOW_PRIMARY=process.env.NEXT_PUBLIC_ANFETA_LEGACY_WORKFLOW!=='1';
const phases={
 saprtuz:{state:'suspended',label:'Suspendida',financial:'unknown'},
 aprtuz:{state:'pending',label:'Por asignar',financial:'unknown'},
 prtuz:{state:'pending',label:'Por hacer',financial:'unknown'},
 rtuz:{state:'review',label:'Por revisar',financial:'unknown'},
 tuz:{state:'completed',label:'Terminada · aprobada',financial:'unknown'},
 uz:{state:'completed',label:'Terminada · cobro/pago pendiente',financial:'pending'},
 z:{state:'completed',label:'Cerrada · cobrada/pagada',financial:'settled'},
} as const;
export function progressiveStage(text:string){
 const match=(text||'').match(/(?<![\p{L}\p{N}_@.\/-])(saprtuz|aprtuz|prtuz|rtuz|tuz|uz|z)(r)(?![\p{L}\p{N}_@.\/-])/iu);
 if(match){const key=match[1].toLowerCase() as keyof typeof phases;return {code:key+'R',category:'revision',...phases[key],token:match[0],index:match.index!};}
 const other=(text||'').match(/(?<![\p{L}\p{N}_@.\/-])z([scp])(?![\p{L}\p{N}_@.\/-])/iu);
 if(!other)return null;
 const category={s:'software',c:'cobro',p:'pago'}[other[1].toLowerCase()]!;
 return {code:'Z'+other[1].toUpperCase(),category,state:'completed' as const,label:category==='software'?'Software terminado':category==='cobro'?'Cobro terminado':'Pago terminado',financial:'unknown' as const,token:other[0],index:other.index!};
}
export function stripProgressiveStage(title:string){const stage=progressiveStage(title);return stage?title.slice(0,stage.index)+title.slice(stage.index+stage.token.length):title;}

export function revisionPhaseTitle(title:string,state:'pending'|'suspended'|'review'|'completed',assign=false){
 const stage=progressiveStage(title);
 const body=(stage?.category==='revision'?stripProgressiveStage(title):title).replace(/(?<![\p{L}\p{N}_@.\/-])(?:saprtuzREVISION|sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|tuzREVISION|uzREVISION|zREVISION)(?![\p{L}\p{N}_@.\/-])/giu,' ').replace(/\s+/g,' ').trim();
 const prefix=PROGRESSIVE_WORKFLOW_PRIMARY?({pending:assign?'aprtuzR':'prtuzR',suspended:'saprtuzR',review:'rtuzR',completed:'tuzR'}[state]):({pending:'prtuzREVISION',suspended:'sprtuzREVISION',review:'rtuzREVISION',completed:'zREVISION'}[state]);
 return prefix+' '+body;
}
