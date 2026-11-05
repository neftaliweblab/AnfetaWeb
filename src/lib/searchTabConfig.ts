import type {ActiveSearchCriterion} from './inlinePredictiveEngine';
export interface SearchTabConfig {
 hideTerminated:boolean;billingFilter:'include'|'only'|'exclude';paymentFilter:'include'|'only'|'exclude';activeCriteria:ActiveSearchCriterion[];
 selectedScope:string;selectedMonth:string;resultPerson:string;groupBy:string;resultSort:any;
 classification:string;filterFavorites:boolean;filterToday:boolean;statusFilter:string;searchOptions:{matchCase:boolean;matchWholeWord:boolean;matchRegex:boolean};
}
export function migrateGroupByPreference(val:string):{groupBy:string;billingFilter?:'exclude';paymentFilter?:'exclude';hideTerminated?:boolean}{
 if(val==='domain_nobilling')return {groupBy:'domain',billingFilter:'exclude' as const,paymentFilter:'exclude' as const};
 if(val==='area_nobilling')return {groupBy:'project_type',billingFilter:'exclude' as const,paymentFilter:'exclude' as const};
 // Legacy name_noterminated actually meant active-first; it never hid completed rows.
 if(val==='name_noterminated')return {groupBy:'person'};
 return {groupBy:val||'none'};
}
export function normalizeSearchTabConfig(raw:unknown):SearchTabConfig{
 const v=raw&&typeof raw==='object'?raw as Record<string,any>:{};
 const text=(key:string,fallback:string)=>typeof v[key]==='string'&&v[key].length<160?v[key]:fallback;
 const mode=(key:string)=>['include','exclude','only'].includes(v[key])?v[key] as 'include'|'exclude'|'only':'include';
 const migration=migrateGroupByPreference(text('groupBy','none'));
 const criteria:ActiveSearchCriterion[]=Array.isArray(v.activeCriteria)?v.activeCriteria.filter((c:any)=>c&&['person','domain','type','tag'].includes(c.type)&&typeof c.id==='string'&&typeof c.value==='string'&&typeof c.label==='string'&&c.value.length<160&&c.label.length<160&&c.id.length<200).slice(0,24).map((c:any)=>({id:c.id,type:c.type,value:c.value,label:c.label,...(typeof c.icon==='string'?{icon:c.icon.slice(0,8)}:{})})):[];
 return {hideTerminated:v.hideTerminated===true,billingFilter:mode('billingFilter'),paymentFilter:mode('paymentFilter'),activeCriteria:criteria,selectedScope:text('selectedScope','Notion'),selectedMonth:text('selectedMonth','Todos'),resultPerson:text('resultPerson','__all__'),resultSort:text('resultSort','scheduled-today'),classification:text('classification','all'),filterFavorites:v.filterFavorites===true,filterToday:v.filterToday===true,statusFilter:text('statusFilter','all'),searchOptions:{matchCase:v.searchOptions?.matchCase===true,matchWholeWord:v.searchOptions?.matchWholeWord===true,matchRegex:v.searchOptions?.matchRegex===true},...migration};
}
