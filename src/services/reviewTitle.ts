import {normalizePerson} from './identityNormalizer';
const tags:Record<string,[string,string]>={John:['jjohn','john'],Karla:['kkarl','karl'],Isaias:['iisai','isai'],Sotelo:['ssote','sote'],Acalli:['aacal','acal'],Andrade:['aandr','andr'],Emmanuel:['eemma','emma'],Brian:['bbria','bria'],Genaro:['ggena','gena'],Neftali:['nneft','neft']};
const phase=/(?<![\p{L}\p{N}_])(?:sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)(?![\p{L}\p{N}_])/giu;
export function reviewTitle(title:string,original:string,reviewer:string,state:'pending'|'returned'|'approved'){
 const owner=tags[normalizePerson(original)],review=tags[normalizePerson(reviewer)];if((!owner&&normalizePerson(original)!=='Sin asignar')||!review)throw new Error('No se encontró la configuración de tags de revisión.');
 const token=(pair:string[])=>new RegExp('(?<![\\p{L}\\p{N}_])(?:'+pair.join('|')+')(?<suffix>\\d*)(?![\\p{L}\\p{N}_])','giu');
 const ownerSuffix=owner?([...title.matchAll(token(owner))][0]?.groups?.suffix||''):'',reviewSuffix=[...title.matchAll(token(review))][0]?.groups?.suffix||'';
 let body=(owner?title.replace(token(owner),' '):title).replace(token(review),' ');const target=state==='pending'?'rtuzREVISION':state==='approved'?'zREVISION':'prtuzREVISION';
 if(phase.test(body)){phase.lastIndex=0;body=body.replace(phase,target);}else body=target+' '+body;phase.lastIndex=0;
 return (body+' '+(owner?(state==='returned'?owner[0]:owner[1])+ownerSuffix:'')+' '+(state==='pending'?review[0]:review[1])+reviewSuffix).replace(/\s{2,}/g,' ').trim();
}
