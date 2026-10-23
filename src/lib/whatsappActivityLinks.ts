import type {WhatsappGroupItem} from './whatsappDirectory';
import {normalizePerson} from '../services/identityNormalizer';
export function normalizeProjectDomain(value:string){
 try{
  const url=new URL(/^[a-z]+:\/\//i.test(value.trim())?value.trim():'https://'+value.trim());
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
  const host=url.hostname.toLowerCase().replace(/\.$/,'').replace(/^www\./,'');
  if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host))return null;
  return host;
 }catch{return null;}
}
export function projectDomains(text:string){
 const found=(text||'').match(/(?<![\p{L}\p{N}_@.\/-])(?:https?:\/\/)?(?:[\p{L}\p{N}][\p{L}\p{N}-]*\.)+[\p{L}]{2,63}(?::\d+)?(?:\/[^\s\]<>]*)?/giu)||[];
 return [...new Set(found.map(s=>normalizeProjectDomain(s.replace(/[),;]+$/,''))).filter((s):s is string=>!!s))];
}
export function whatsappGroupKey(group:Pick<WhatsappGroupItem,'id'|'owner'>){return normalizePerson(group.owner||'')+':'+group.id;}
export type DomainGroupLinks=Record<string,string[]>;
export function relatedWhatsappGroups(title:string,groups:WhatsappGroupItem[],links:DomainGroupLinks={}){
 const domains=projectDomains(title);
 const matches=groups.filter(group=>{const named=projectDomains(group.name);return domains.some(domain=>(links[domain]||[]).includes(whatsappGroupKey(group))||(named.length?named.includes(domain):normalizeProjectDomain(group.domain||'')===domain));});
 const unique=[...new Map(matches.map(g=>[whatsappGroupKey(g),g])).values()];
 return {domains,groups:unique,state:!domains.length?'no-domain':!unique.length?'unlinked':unique.length===1?'matched':'multiple'};
}
export const whatsappLinksKey=(owner:string)=>'anfeta_whatsapp_domain_links_v1:'+normalizePerson(owner);
export function readDomainLinks(raw:string|null):DomainGroupLinks{
 try{const data=JSON.parse(raw||'{}');return Object.fromEntries(Object.entries(data).flatMap(([key,value])=>{const domain=normalizeProjectDomain(key);return domain&&Array.isArray(value)?[[domain,[...new Set(value.filter(v=>typeof v==='string'&&v.length<300))]]]:[];}));}catch{return {};}
}
