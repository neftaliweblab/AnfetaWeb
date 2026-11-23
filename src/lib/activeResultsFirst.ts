import {searchDatabaseName} from './searchDatabase';
import {progressiveStage,PROGRESSIVE_WORKFLOW_PRIMARY} from '@/services/progressiveWorkflow';
import {workflowState} from '@/services/activityWorkflow';
import {parseVisualParts, formatAreaLabel, resolveItemDomain} from '@/lib/visualTitleParser';
import {normalizePerson} from '@/services/identityNormalizer';
import {resultAssignedPerson} from '@/services/activityTags';
import {resultMonthKey,sortMonthGroups} from './searchMonthOrder';


export function isCompletedResult(item: any): boolean {
  if (!item) return false;
  const status = String(item.updateStatus || item.status || item.UpdateStatus || item.Status || '').trim();
  const title = String(item.name || item.title || item.Name || item.Title || '').trim();
  return workflowState(status, title) === 'completed';
}

/** Identifica si el ítem está administrativamente finalizado/cerrado (z / zR / ZZ / FIN) */
export function isFinalizedResult(item: any): boolean {
  if (!item) return false;
  const status = String(item.updateStatus || item.status || item.UpdateStatus || item.Status || '').trim().toLowerCase();
  const title = String(item.name || item.title || item.Name || item.Title || '').trim().toLowerCase();
  if (status.includes('finaliz') || status === 'fin' || status === 'cerrada' || /^z\b/.test(status) || status.includes('cobro/documentacion') || status.includes('cobrado')) return true;
  const stage = progressiveStage(title);
  if (stage && (stage.code.toLowerCase().startsWith('z') || stage.financial === 'settled')) return true;
  return /(?<![\p{L}\p{N}_@.\/-])(?:z[rsdcp]?|zz)(?![\p{L}\p{N}_@.\/-])/iu.test(title);
}

/** Identifica si el ítem está técnicamente terminado pero pendiente de cierre/cobro (tuz / tuzR / TER) */
export function isOperativeTerminatedResult(item: any): boolean {
  if (!item) return false;
  return isCompletedResult(item) && !isFinalizedResult(item);
}

export function isBillingItem(item: any): boolean {
  if (!item) return false;
  const dbSource = String(item?.sourceName || item?.externalSourceName || item?.databaseName || '').toLowerCase();
  const dbId = String(item?.databaseId || '').replace(/-/g, '').toLowerCase();
  if (dbId === '2eeabd7d91b781a5a2eec9a20d3d656a') return true;
  if (dbSource.includes('cobrar') || dbSource.includes('pagar') || dbSource.includes('cobro') || dbSource.includes('pago')) return true;
  return isCobroItem(item) || isPagoItem(item);
}

export function isCobroItem(item: any): boolean {
  if (!item) return false;
  const src = String(item?.sourceName || item?.externalSourceName || item?.path || item?.databaseName || '').toLowerCase();
  const name = String(item?.name || item?.title || item?.Name || item?.Title || '').toLowerCase();

  // 1. Si explícitamente tiene prefijo o token de pago, NO es cobro
  if (
    /(?<![\w@.\/-])(?:saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|rtuz|tuz|uz|z)p\b/i.test(name) ||
    /\b(?:zpagar|ppago|ppaga|ppag|prtuzpagar|aprtuzpagar)\b/i.test(name) ||
    /^pagar\s/i.test(name) ||
    /\[pagar\]/i.test(name) ||
    /\[pagos\]/i.test(name)
  ) {
    return false;
  }

  // 2. Si explícitamente tiene prefijo de revisión (R) y no está en base de cobros, no es cobro
  if (
    /(?<![\w@.\/-])(?:saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|rtuz|tuz|uz|z)r\b/i.test(name) &&
    !src.includes('cobrar') && !src.includes('cobro')
  ) {
    return false;
  }

  // 3. Categoría del workflow progresivo
  const stage = progressiveStage(name);
  if (stage?.category === 'cobro') return true;
  if (stage?.category === 'pago') return false;

  // 4. Tokens explícitos de cobro en título
  if (
    /(?<![\w@.\/-])(?:saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|rtuz|tuz|uz|z)c\b/i.test(name) ||
    /\b(?:zcobrar|ccobro|ccobr|ccob|prtuzcobrar|aprtuzcobrar|cobranza)\b/i.test(name) ||
    /^cobrar\s/i.test(name) ||
    /\[cobrar\]/i.test(name) ||
    /\[cobros\]/i.test(name)
  ) {
    return true;
  }

  // 5. Base exclusiva de cobros
  if (/^(?:cobros?|por cobrar|zcobrar|cobranza|cuentas por cobrar)$/i.test(src)) {
    return true;
  }

  // 6. Base combinada "Cobrar y pagar"
  if (src.includes('cobrar y pagar') || src.includes('cobros y pagos') || (src.includes('cobrar') && src.includes('pagar'))) {
    if (/\b(?:pago|pagar|proveedor|gasto|egreso|nomina|nómina)\b/i.test(name)) return false;
    if (/\b(?:mensualidad|hosting|cliente|factura|ingreso|anticipo|cuota|anual|cobro|cobrar)\b/i.test(name)) return true;
    return true;
  }

  return false;
}

export function isPagoItem(item: any): boolean {
  if (!item) return false;
  const src = String(item?.sourceName || item?.externalSourceName || item?.path || item?.databaseName || '').toLowerCase();
  const name = String(item?.name || item?.title || item?.Name || item?.Title || '').toLowerCase();

  // 1. Si explícitamente tiene prefijo o token de cobro, NO es pago
  if (
    /(?<![\w@.\/-])(?:saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|rtuz|tuz|uz|z)c\b/i.test(name) ||
    /\b(?:zcobrar|ccobro|ccobr|ccob|prtuzcobrar|aprtuzcobrar|cobranza)\b/i.test(name) ||
    /^cobrar\s/i.test(name) ||
    /\[cobrar\]/i.test(name) ||
    /\[cobros\]/i.test(name)
  ) {
    return false;
  }

  // 2. Si explícitamente tiene prefijo de revisión (R) y no está en base de pagos, no es pago
  if (
    /(?<![\w@.\/-])(?:saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|rtuz|tuz|uz|z)r\b/i.test(name) &&
    !src.includes('pagar') && !src.includes('pago')
  ) {
    return false;
  }

  // 3. Categoría del workflow progresivo
  const stage = progressiveStage(name);
  if (stage?.category === 'pago') return true;
  if (stage?.category === 'cobro') return false;

  // 4. Tokens explícitos de pago en título
  if (
    /(?<![\w@.\/-])(?:saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|rtuz|tuz|uz|z)p\b/i.test(name) ||
    /\b(?:zpagar|ppago|ppaga|ppag|prtuzpagar|aprtuzpagar)\b/i.test(name) ||
    /^pagar\s/i.test(name) ||
    /\[pagar\]/i.test(name) ||
    /\[pagos\]/i.test(name)
  ) {
    return true;
  }

  // 5. Base exclusiva de pagos
  if (/^(?:pagos?|por pagar|zpagar|cuentas por pagar)$/i.test(src)) {
    return true;
  }

  // 6. Base combinada "Cobrar y pagar"
  if (src.includes('cobrar y pagar') || src.includes('cobros y pagos') || (src.includes('cobrar') && src.includes('pagar'))) {
    if (/\b(?:pago|pagar|proveedor|gasto|egreso|nomina|nómina)\b/i.test(name)) return true;
    if (/\b(?:mensualidad|hosting|cliente|factura|ingreso|anticipo|cuota|anual|cobro|cobrar)\b/i.test(name)) return false;
    return false;
  }

  return false;
}

export function getItemGroupKey(item: any, groupBy: string): string {
  if (!item) return "";
  if(groupBy==='database')return '🗃️ '+(searchDatabaseName(item)||(String(item.source||'').toLowerCase()==='dropbox'?'Dropbox · sin base de Notion':'Base sin identificar'));
  const name = String(item.name || item.title || item.Name || "").toLowerCase();
  const parsed = parseVisualParts(item.name || item.title || item.Name || "", item.updateStatus || item.status || "", item.contentSnippet);

  if (groupBy === "name" || groupBy === "name_noterminated" || groupBy === "person") {
    const person=normalizePerson(resultAssignedPerson(item));
    if(person!=='Sin asignar')return '👤 '+person;
    return "👤 Sin persona asignada";
  }

  if (groupBy === "domain" || groupBy === "domain_nobilling") {
    const dom = resolveItemDomain(item, parsed.domain);
    return dom ? `🌐 ${dom}` : "🌐 Sin dominio";
  }

  if(groupBy==='status')return 'Estado: '+(parsed.workflow||'Sin clasificar');
  if (groupBy === "project_suffix") {
    const dom = resolveItemDomain(item, parsed.domain) || "Sin dominio";
    const suffixMatch = String(item.name || item.title || "").match(/\.(webs|ads|seo|app|apli|prog|soft)\b/i);
    const suffix = suffixMatch ? suffixMatch[0] : ".general";
    return `📁 ${dom} · ${suffix}`;
  }

  if (groupBy === "month") {
    return resultMonthKey(item);
  }

  if (groupBy === "project_type" || groupBy === "area" || groupBy === "area_nobilling") {
    const rawArea = parsed.area || item.areaChip;
    return rawArea ? `🏷️ Área: ${formatAreaLabel(rawArea)}` : "🏷️ Otros";
  }

  return "";
}

/** Stable partition: keep the existing date/name/source order within each side. */
export function activeResultsFirst<T>(items: readonly T[]): T[] {
  const active: T[] = [], completed: T[] = [];
  for (const item of items) (isCompletedResult(item) ? completed : active).push(item);
  return [...active, ...completed];
}

/** Preserve group identities; move groups containing only completed rows last. */
export function activeGroupsFirst<T, G extends { items: T[] }>(groups: G[]): G[] {
  const active: G[] = [], completed: G[] = [];
  for (const group of groups) {
    const sorted = { ...group, items: activeResultsFirst(group.items) };
    (group.items.length > 0 && group.items.every(isCompletedResult) ? completed : active).push(sorted);
  }
  return [...active, ...completed];
}

/** Order the full result set before pagination, respecting grouping rules. */
export function sortResultGroups<T,G extends {key?:string;items:T[]}>(groups:G[],groupBy:string,now=new Date()):G[]{
  if(groupBy==='month')return sortMonthGroups(groups.map(group=>({...group,items:activeResultsFirst(group.items)})),now);
  const sorted = activeGroupsFirst(groups);
  if (groupBy === 'domain' || groupBy === 'domain_nobilling' || groupBy === 'project_type' || groupBy === 'area' || groupBy === 'area_nobilling') {
    const isFallback = (key?: string) => key === '🌐 Sin dominio' || key === '🌐 General' || key === '🏷️ Otros';
    return [
      ...sorted.filter((g) => !isFallback(g.key)),
      ...sorted.filter((g) => isFallback(g.key)),
    ];
  }
  return sorted;
}
export function orderSearchResults<T>(items: readonly T[], groupBy?: string,now=new Date()): T[] {
  if (!groupBy || groupBy === "none") {
    return activeResultsFirst(items);
  }

  const map = new Map<string, T[]>();
  for (const item of items) {
    if (groupBy.includes("nobilling") && isBillingItem(item)) {
      continue;
    }
    const key = getItemGroupKey(item, groupBy);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
  }

  const rawGroups = Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    items: groupItems,
  }));

  const sortedGroups = sortResultGroups(rawGroups,groupBy,now);
  return sortedGroups.flatMap(group => group.items);
}

