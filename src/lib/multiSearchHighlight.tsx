import React from "react";

export interface PaletteItem {
  key: string;
  label: string;
  text: string;
  bg: string;
  border: string;
  badge: string;
  hex: string;
}

export const MULTI_SEARCH_PALETTE: PaletteItem[] = [
  {
    key: "cyan",
    label: "Cian",
    text: "text-[#38BDF8]",
    bg: "bg-[#0284C7]/25",
    border: "border-[#38BDF8]/70",
    badge: "text-[#38BDF8] bg-[#0284C7]/25 border border-[#38BDF8]/70 px-1 py-[1px] mx-0.5 rounded font-bold font-mono inline-block align-baseline leading-none shadow-[0_0_6px_rgba(56,189,248,0.25)]",
    hex: "#38BDF8",
  },
  {
    key: "pink",
    label: "Rosa",
    text: "text-[#F472B6]",
    bg: "bg-[#EC4899]/25",
    border: "border-[#F472B6]/70",
    badge: "text-[#F472B6] bg-[#EC4899]/25 border border-[#F472B6]/70 px-1 py-[1px] mx-0.5 rounded font-bold font-mono inline-block align-baseline leading-none shadow-[0_0_6px_rgba(244,114,182,0.25)]",
    hex: "#F472B6",
  },
  {
    key: "amber",
    label: "Ámbar",
    text: "text-[#FBBF24]",
    bg: "bg-[#D97706]/30",
    border: "border-[#FBBF24]/70",
    badge: "text-[#FBBF24] bg-[#D97706]/30 border border-[#FBBF24]/70 px-1 py-[1px] mx-0.5 rounded font-bold font-mono inline-block align-baseline leading-none shadow-[0_0_6px_rgba(251,191,36,0.25)]",
    hex: "#FBBF24",
  },
  {
    key: "emerald",
    label: "Esmeralda",
    text: "text-[#34D399]",
    bg: "bg-[#059669]/25",
    border: "border-[#34D399]/70",
    badge: "text-[#34D399] bg-[#059669]/25 border border-[#34D399]/70 px-1 py-[1px] mx-0.5 rounded font-bold font-mono inline-block align-baseline leading-none shadow-[0_0_6px_rgba(52,211,153,0.25)]",
    hex: "#34D399",
  },
  {
    key: "purple",
    label: "Púrpura",
    text: "text-[#C084FC]",
    bg: "bg-[#7E22CE]/30",
    border: "border-[#C084FC]/70",
    badge: "text-[#C084FC] bg-[#7E22CE]/30 border border-[#C084FC]/70 px-1 py-[1px] mx-0.5 rounded font-bold font-mono inline-block align-baseline leading-none shadow-[0_0_6px_rgba(192,132,252,0.25)]",
    hex: "#C084FC",
  },
  {
    key: "orange",
    label: "Naranja",
    text: "text-[#FB923C]",
    bg: "bg-[#EA580C]/30",
    border: "border-[#FB923C]/70",
    badge: "text-[#FB923C] bg-[#EA580C]/30 border border-[#FB923C]/70 px-1 py-[1px] mx-0.5 rounded font-bold font-mono inline-block align-baseline leading-none shadow-[0_0_6px_rgba(251,146,60,0.25)]",
    hex: "#FB923C",
  },
];

const OPERATORS = new Set(["and", "or", "not", "&&", "||", "&", "|", "+"]);
const PREFIX_FILTERS = ["ext:", "folder:", "type:", "nopath:", "source:", "size:", "dm:", "date:", "regex:"];
const ANFETA_TAGS = new Set([
  "prtuzrevision",
  "rtuzrevision",
  "zrevision",
  "zclientes",
  "zdominios",
  "zproyectos",
  "zpagar",
  "zcobrar",
  "zcorreos",
]);

export function normalizeDiacritics(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const ACCENT_MAP: Record<string, string> = {
  a: "[aáàäâãAÁÀÄÂÃ]",
  á: "[aáàäâãAÁÀÄÂÃ]",
  e: "[eéèëêEÉÈËÊ]",
  é: "[eéèëêEÉÈËÊ]",
  i: "[iíìïîIÍÌÏÎ]",
  í: "[iíìïîIÍÌÏÎ]",
  o: "[oóòöôõOÓÒÖÔÕ]",
  ó: "[oóòöôõOÓÒÖÔÕ]",
  u: "[uúùüûUÚÙÜÛ]",
  ú: "[uúùüûUÚÙÜÛ]",
  ü: "[uúùüûUÚÙÜÛ]",
  n: "[nñNÑ]",
  ñ: "[nñNÑ]",
  c: "[cçCÇ]",
  ç: "[cçCÇ]",
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function makeAccentRegexPattern(word: string): string {
  return word
    .split("")
    .map((char) => ACCENT_MAP[char.toLowerCase()] || escapeRegExp(char))
    .join("");
}

/**
 * Extrae los términos de búsqueda individuales de una consulta múltiple,
 * ignorando operadores lógicos (AND, OR, NOT), filtros especiales y prefijos.
 */
export function extractSearchTerms(query: string): string[] {
  if (!query) return [];
  const raw = query.trim();
  if (!raw) return [];

  const regex = /([a-zA-Z]+:"[^"]+")|"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  const terms: string[] = [];
  const seen = new Set<string>();

  while ((match = regex.exec(raw)) !== null) {
    const isQuoted = !!match[2];
    let val = isQuoted ? match[2] : (match[1] || match[3] || "");
    val = val.replace(/^[\(\[\{]+|[\)\]\}]+$/g, "").trim();

    if (!isQuoted) {
      const lower = val.toLowerCase();
      if (OPERATORS.has(lower)) continue;
      if (PREFIX_FILTERS.some((pfx) => lower.startsWith(pfx))) continue;
      if (ANFETA_TAGS.has(lower)) continue;
      // Términos negados (-word o !word) no se resaltan
      if ((val.startsWith("-") || val.startsWith("!")) && val.length > 1) continue;
      if (val.startsWith(".")) val = val.slice(1);
    }

    val = val.trim();
    if (val.length >= 2) {
      const norm = normalizeDiacritics(val);
      if (!seen.has(norm)) {
        seen.add(norm);
        terms.push(val);
      }
    }
  }

  return terms;
}

/**
 * Retorna un mapa del término (tanto directo como normalizado sin acentos)
 * a su color de paleta correspondiente.
 */
export function getSearchTermColorMap(query: string): {
  terms: string[];
  termColorMap: Map<string, PaletteItem>;
} {
  const terms = extractSearchTerms(query);
  const termColorMap = new Map<string, PaletteItem>();

  terms.forEach((term, index) => {
    const palette = MULTI_SEARCH_PALETTE[index % MULTI_SEARCH_PALETTE.length];
    termColorMap.set(term.toLowerCase(), palette);
    termColorMap.set(normalizeDiacritics(term), palette);
  });

  return { terms, termColorMap };
}

/**
 * Resalta cada término de búsqueda en el texto con un color diferenciado
 * según su orden (Cian para término 1, Rosa para término 2, etc.) con estilo de badge nítido,
 * tolerante a mayúsculas/minúsculas y acentos.
 */
export function highlightMultiSearch(text: string, query: string): React.ReactNode {
  if (!text || !query || query.trim().length < 2) return text;

  const { terms, termColorMap } = getSearchTermColorMap(query);
  if (terms.length === 0) return text;

  // Ordenar por longitud descendente para que palabras más largas tengan precedencia
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const escapedPattern = sorted
    .map((w) => makeAccentRegexPattern(w))
    .join("|");

  try {
    const regex = new RegExp(`(${escapedPattern})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (!part) return null;
      const low = part.toLowerCase();
      const norm = normalizeDiacritics(part);
      const style = termColorMap.get(low) || termColorMap.get(norm);
      if (style) {
        return (
          <span key={i} className={`${style.badge} transition-all`}>
            {part}
          </span>
        );
      }
      return part;
    });
  } catch {
    return text;
  }
}
