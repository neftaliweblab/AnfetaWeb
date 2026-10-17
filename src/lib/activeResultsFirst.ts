import {workflowState} from '@/services/activityWorkflow';
import {parseVisualParts} from '@/lib/visualTitleParser';

export const PERSON_ALIASES: Record<string, string> = {
  jjohn: "John",
  john: "John",
  aandr: "Andrade",
  andrade: "Andrade",
  nneft: "Neftali",
  neftali: "Neftali",
  bbria: "Brian",
  brian: "Brian",
  ggena: "Genaro",
  genaro: "Genaro",
  iisaia: "Isaias",
  iisai: "Isaias",
  isaias: "Isaias",
  kkarl: "Karla",
  karla: "Karla",
  eedua: "Sotelo",
  ssote: "Sotelo",
  sotelo: "Sotelo",
  eduardo: "Sotelo",
  aacal: "Acali",
  acalli: "Acali",
  pedro: "Pedro",
};

export function isCompletedResult(item: any): boolean {
  if (!item) return false;
  const status = String(item.updateStatus || item.status || item.UpdateStatus || item.Status || '').trim();
  const title = String(item.name || item.title || item.Name || item.Title || '').trim();
  return workflowState(status, title) === 'completed';
}

export function isBillingItem(item: any): boolean {
  const src = String(item?.sourceName || '').toLowerCase();
  const name = String(item?.name || item?.title || '').toLowerCase();
  return src.includes("pagar") || src.includes("cobrar") || name.includes("cobrar") || name.includes("pagar");
}

export function getItemGroupKey(item: any, groupBy: string): string {
  if (!item) return "";
  const name = String(item.name || item.title || item.Name || "").toLowerCase();
  const parsed = parseVisualParts(item.name || item.title || item.Name || "", item.updateStatus || item.status || "", item.contentSnippet);

  if (groupBy === "name" || groupBy === "name_noterminated" || groupBy === "person") {
    for (const [key, label] of Object.entries(PERSON_ALIASES)) {
      if (name.includes(key)) {
        return `👤 ${label}`;
      }
    }
    return "👤 Sin persona asignada";
  }

  if (groupBy === "domain" || groupBy === "domain_nobilling") {
    const dom = parsed.domain || item.domainChip || item.domain || item.sourceName || "General";
    const status = parsed.workflow || item.updateStatus || item.status || "Activo";
    return `🌐 ${dom} · ${status}`;
  }

  if (groupBy === "project_suffix") {
    const dom = parsed.domain || item.domainChip || item.domain || "General";
    const suffixMatch = String(item.name || item.title || "").match(/\.(webs|ads|seo|app|prog)\b/i);
    const suffix = suffixMatch ? suffixMatch[0] : ".general";
    return `📁 ${dom} · ${suffix}`;
  }

  if (groupBy === "month") {
    return parsed.monthCode || item.monthChip ? `📅 Mes: ${parsed.monthCode || item.monthChip}` : "📅 Sin mes";
  }

  if (groupBy === "area" || groupBy === "area_nobilling") {
    return parsed.area || item.areaChip ? `🏷️ Área: ${parsed.area || item.areaChip}` : "🏷️ Otros";
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
export function orderSearchResults<T>(items: readonly T[], groupBy?: string): T[] {
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

  const sortedGroups = activeGroupsFirst(rawGroups);
  return sortedGroups.flatMap(group => group.items);
}

