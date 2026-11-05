import {parseVisualParts} from './visualTitleParser';
import { normalizePerson } from "@/services/identityNormalizer";
import { resultAssignedPerson } from "@/services/activityTags";

export interface ActiveSearchCriterion {
  id: string;
  type: "person" | "domain" | "type" | "tag";
  label: string;
  value: string;
  icon?: string;
}

export interface InlineSearchSuggestion {
  id: string;
  type: "person" | "domain" | "type" | "tag";
  label: string;
  value: string;
  count: number;
  icon?: string;
}

/**
 * Structured taxonomy for activity types and categories.
 * Symmetric between suggestion generation and filtering.
 */
export const STRUCTURED_TYPE_DEFINITIONS: Record<string, { regex: RegExp; icon: string }> = {
  PROGRAMAS: {
    regex: /\b(?:pprog|ssoft|software|programas?|desarrollo)\b|11\.s\.0[1-4]\.00/i,
    icon: "💻",
  },
  WEBS: {
    regex: /\b(?:wwebs|webs?|sitio|portal)\b|11\.w\./i,
    icon: "🌐",
  },
  ADS: {
    regex: /\b(?:aads|ads|campa[ñn]as?|adwords)\b|11\.a\./i,
    icon: "📈",
  },
  SEO: {
    regex: /\b(?:sseo|seo|posicionamiento|search\s*console)\b|11\.s\./i,
    icon: "🔍",
  },
  APP: {
    regex: /\b(?:aapli|apli|apps?|aplicaci[oó]n)\b|11\.a\./i,
    icon: "📱",
  },
  COTIZACIÓN: {
    regex: /\b(?:ccoti|coti|cotizaci[oó]n|presupuesto)\b|11\.c\./i,
    icon: "📄",
  },
  DISEÑO: {
    regex: /\b(?:ddise|dise[ñn]o|branding|flyer|logo|identidad)\b/i,
    icon: "🎨",
  },
  MAPS: {
    regex: /\b(?:mmaps|maps|gmb|google\s*maps)\b/i,
    icon: "📍",
  },
  REDES: {
    regex: /\b(?:rrede|redes|social|facebook|instagram)\b|11\.f\./i,
    icon: "💬",
  },
  COBROS: {
    regex: /\b(?:cobranza|cobros?|zcobrar|prtuzcobrar|factura|ingreso)\b/i,
    icon: "💰",
  },
  PAGOS: {
    regex: /\b(?:pagos?|zpagar|prtuzpagar|egreso|proveedor)\b/i,
    icon: "💳",
  },
};

/**
 * Checks if an item matches a structured type category.
 * Symmetric across suggestion counting and active criteria filtering.
 */
export function itemMatchesStructuredType(item:any,typeName:string):boolean {
 if(!item||!typeName)return false;
 const area=parseVisualParts(String(item.name||item.title||item.Name||''),String(item.updateStatus||item.status||'')).area.toUpperCase();
 const aliases:Record<string,string>={PROG:'PROGRAMAS',SOFTWARE:'PROGRAMAS',WEB:'WEBS',APLICACIÓN:'APP',COBRO:'COBROS',PAGO:'PAGOS'};
 const canonical=typeName.trim().toUpperCase();
 return (aliases[area]||area)===canonical;
}

/**
 * Detects all structured types matching a single item.
 */
export function detectStructuredTypes(item: any): string[] {
  const matches: string[] = [];
  for (const typeName of Object.keys(STRUCTURED_TYPE_DEFINITIONS)) {
    if (itemMatchesStructuredType(item, typeName)) {
      matches.push(typeName);
    }
  }
  return matches;
}

/**
 * Computes live contextual suggestions based on current query and available filtered items.
 * Strictly calculates real counts from memory; no network calls per keystroke.
 * When items is empty, returns empty array without falling back to whole catalog.
 */
export function computeInlineSuggestions(
  query: string,
  items: any[],
  activeCriteria: ActiveSearchCriterion[] = []
): InlineSearchSuggestion[] {
  const trimmed = (query || "").trim();
  if (!trimmed) return [];
  // Point 4: If current filtered items is empty, do not substitute with full catalog!
  if (!items || items.length === 0) return [];

  const existingCriterionKeys = new Set(
    activeCriteria.map((c) => `${c.type}:${c.value.toLowerCase()}`)
  );

  const personCounts = new Map<string, number>();
  const domainCounts = new Map<string, number>();
  const areaCounts = new Map<string, number>();

  const lowerQuery = trimmed.toLowerCase();

  for (const item of items) {
    // 1. Person
    const person = resultAssignedPerson(item);
    if (person && (person as string) !== "Sin asignar") {
      const norm = normalizePerson(person);
      personCounts.set(norm, (personCounts.get(norm) || 0) + 1);
    }

    // 2. Domain
    const domain = (item.domain || item.domainChip || "").trim().toLowerCase();
    if (domain && domain.includes(".") && !domain.startsWith("http")) {
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    } else {
      const match = String(item.name || item.title || "").match(
        /\b(?:[a-z0-9_-]+\.)+[a-z]{2,}\b/i
      );
      if (match) {
        const dom = match[0].toLowerCase();
        domainCounts.set(dom, (domainCounts.get(dom) || 0) + 1);
      }
    }

    // 3. Area / Structured Types
    const matchedTypes = detectStructuredTypes(item);
    for (const t of matchedTypes) {
      areaCounts.set(t, (areaCounts.get(t) || 0) + 1);
    }
  }

  const suggestions: InlineSearchSuggestion[] = [];

  // Add areas / types
  for (const [area, count] of areaCounts.entries()) {
    if (!existingCriterionKeys.has(`type:${area.toLowerCase()}`) && count > 0) {
      const def = STRUCTURED_TYPE_DEFINITIONS[area];
      suggestions.push({
        id: `type_${area}`,
        type: "type",
        label: area,
        value: area,
        count,
        icon: def?.icon || "⚙",
      });
    }
  }

  // Add people
  for (const [person, count] of personCounts.entries()) {
    if (!existingCriterionKeys.has(`person:${person.toLowerCase()}`) && count > 0) {
      suggestions.push({
        id: `person_${person}`,
        type: "person",
        label: person,
        value: person,
        count,
        icon: "👤",
      });
    }
  }

  // Add top domains
  for (const [dom, count] of domainCounts.entries()) {
    if (!existingCriterionKeys.has(`domain:${dom.toLowerCase()}`) && count > 0) {
      suggestions.push({
        id: `domain_${dom}`,
        type: "domain",
        label: dom,
        value: dom,
        count,
        icon: "🌐",
      });
    }
  }

  // Sort by relevance: matching query substring gets a boost, then count
  return suggestions.sort((a, b) => {
    const aMatch = a.label.toLowerCase().includes(lowerQuery) ? 1000 : 0;
    const bMatch = b.label.toLowerCase().includes(lowerQuery) ? 1000 : 0;
    return bMatch + b.count - (aMatch + a.count);
  });
}
