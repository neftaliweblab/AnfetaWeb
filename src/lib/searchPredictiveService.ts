export interface NotionBaseShortcut {
  primaryAlias: string;
  sourceName: string;
  pathLabel: string;
  displayLabel: string;
  titleFilter?: string;
  aliases: string[];
}

export interface PredictiveSuggestionItem {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  kind: "Base" | "Domain" | "Topic";
  count?: number;
}

export const NOTION_BASE_SHORTCUTS: NotionBaseShortcut[] = [
  {
    primaryAlias: "zrevisiones",
    sourceName: "Revisiones",
    pathLabel: "Revisiones",
    displayLabel: "Revisiones",
    aliases: ["zrevision", "zrevbase", "zrev"],
  },
  {
    primaryAlias: "zclientes",
    sourceName: "Clientes",
    pathLabel: "zCLIENTES",
    displayLabel: "Clientes",
    aliases: ["zcliente", "zcli"],
  },
  {
    primaryAlias: "zdominios",
    sourceName: "Dominios",
    pathLabel: "zDOMINIOS",
    displayLabel: "Dominios",
    aliases: ["zdominio", "zdom"],
  },
  {
    primaryAlias: "zproyectos",
    sourceName: "Programas y proyectos",
    pathLabel: "zPROYECTOS",
    displayLabel: "Proyectos",
    aliases: ["zproyecto", "zprogramas", "zprograma", "zproy", "zprog"],
  },
  {
    primaryAlias: "zcorreos",
    sourceName: "Correos Contraseñas",
    pathLabel: "zCORREOS",
    displayLabel: "Correos",
    aliases: ["zcorreo", "zpass", "zpasswords", "zcontraseñas"],
  },
  {
    primaryAlias: "zpagar",
    sourceName: "Cobrar y pagar",
    pathLabel: "zPAGAR",
    displayLabel: "Pagar",
    titleFilter: "PAGAR",
    aliases: ["zpago"],
  },
  {
    primaryAlias: "zcobrar",
    sourceName: "Cobrar y pagar",
    pathLabel: "zCOBRAR",
    displayLabel: "Cobrar",
    titleFilter: "COBRAR",
    aliases: ["zcobro"],
  },
];

export const DEFAULT_SAVED_SEARCHES = [
  "zrevision",
  "zclientes",
  "pdf",
  "docx",
  "mhad.com.mx",
  "rtuzrevision",
  "prueba nneft guardar",
];

const STOP_WORDS = new Set([
  "de", "la", "el", "en", "y", "a", "los", "del", "se", "las", "por", "un",
  "para", "con", "no", "una", "su", "al", "lo", "como", "mas", "pero", "sus",
  "le", "ya", "o", "fue", "este", "ha", "si", "porque", "esta", "son", "entre",
  "cuando", "muy", "sin", "sobre", "ser", "tiene", "tambien", "me", "hasta",
  "hay", "donde", "han", "quien", "están", "estado", "desde", "todo", "nos",
  "durante", "estados", "todos", "uno", "les", "ni", "contra", "otros", "fueron",
  "ese", "eso", "había", "ante", "ellos", "e", "esto", "mí", "antes", "algunos",
  "qué", "unos", "yo", "otro", "otras", "otra", "él", "tanto", "esa", "estos",
  "mucho", "quienes", "nada", "muchos", "cual", "sea", "poco", "ella", "estar",
  "haber", "estas", "estaba", "estamos", "algunas", "algo", "nosotros", "prtuz",
  "rtuz", "sprtuz", "zrevision",
]);

const DOMAIN_REGEX = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com\.mx|org\.mx|gob\.mx|edu\.mx|net\.mx|com|mx|org|net|io|co|app|dev))\b/gi;

export function extractPredictiveDomains(text: string): string[] {
  if (!text) return [];
  const domains: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(DOMAIN_REGEX);
  while ((match = regex.exec(text)) !== null) {
    const d = match[1]?.toLowerCase().trim();
    if (d && !d.includes("ejemplo.com") && !d.includes("dominio.com") && !d.includes("tudominio.com")) {
      if (!domains.includes(d)) domains.push(d);
    }
  }
  return domains;
}

export function resolveNotionBaseScope(query: string): {
  hasBase: boolean;
  shortcut?: NotionBaseShortcut;
  remainder: string;
} {
  const q = (query || "").trim();
  if (!q) return { hasBase: false, remainder: "" };

  const firstToken = q.split(/\s+/)[0]?.toLowerCase() || "";
  const remainder = q.substring(firstToken.length).trim();

  for (const sc of NOTION_BASE_SHORTCUTS) {
    if (
      sc.primaryAlias.toLowerCase() === firstToken ||
      sc.aliases.some((a) => a.toLowerCase() === firstToken)
    ) {
      return { hasBase: true, shortcut: sc, remainder };
    }
  }

  return { hasBase: false, remainder: q };
}

export function buildPredictiveData(
  query: string,
  searchIndex: any[],
  customSavedSearches: string[] = DEFAULT_SAVED_SEARCHES
): {
  headerText: string;
  suggestions: PredictiveSuggestionItem[];
  savedSearches: string[];
  hintText: string;
} {
  const rawQ = (query || "").trim();
  const lowerQ = rawQ.toLowerCase();
  const scope = resolveNotionBaseScope(rawQ);

  const suggestions: PredictiveSuggestionItem[] = [];

  // 1. Si está vacío o escribiendo prefijo z
  if (!rawQ || (rawQ.startsWith("z") && !rawQ.includes(" "))) {
    const matchedBases = NOTION_BASE_SHORTCUTS.filter((sc) => {
      if (!rawQ) return true;
      return (
        sc.primaryAlias.toLowerCase().startsWith(lowerQ) ||
        sc.aliases.some((a) => a.toLowerCase().startsWith(lowerQ))
      );
    });

    matchedBases.forEach((sc) => {
      suggestions.push({
        id: `base-${sc.primaryAlias}`,
        title: sc.primaryAlias,
        subtitle: `Filtrar ${sc.pathLabel}`,
        query: `${sc.primaryAlias} `,
        kind: "Base",
      });
    });

    // Añadir dominios frecuentes de hoy o del índice
    const domainCounts = new Map<string, number>();
    for (const row of searchIndex.slice(0, 1000)) {
      const name = row.name || row.displayName || "";
      const dList = extractPredictiveDomains(name);
      for (const d of dList) {
        domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
      }
    }

    Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([domain, count]) => {
        suggestions.push({
          id: `dom-${domain}`,
          title: domain,
          subtitle: `Dominio completo · aparece ${count}x`,
          query: domain,
          kind: "Domain",
          count,
        });
      });

    const saved = customSavedSearches.filter((s) => !rawQ || s.toLowerCase().includes(lowerQ));

    return {
      headerText: "Búsquedas rápidas",
      suggestions,
      savedSearches: saved,
      hintText: "Escribe zrevision, zclientes, zdominios, zproyectos, zpagar o zcorreos · Clic para agregar",
    };
  }

  // 2. Si tiene una base activa en el query (e.g. zrevision ...)
  if (scope.hasBase && scope.shortcut) {
    const sc = scope.shortcut;
    const baseRows = searchIndex.filter((row) => {
      const sName = (row.sourceName || row.externalSourceName || "").toLowerCase();
      return sName.includes(sc.sourceName.toLowerCase());
    });

    // Extraer dominios y palabras frecuentes en esa base
    const domainCounts = new Map<string, number>();
    const wordCounts = new Map<string, number>();
    const currentToken = (rawQ.split(/\s+/).pop() || "").toLowerCase();

    for (const row of baseRows) {
      const text = `${row.name || ""} ${row.description || ""} ${row.searchQuery || ""}`;
      const dList = extractPredictiveDomains(text);
      for (const d of dList) {
        if (!currentToken || d.includes(currentToken)) {
          domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
        }
      }

      const words = (row.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ\.\-\s]/g, " ")
        .split(/\s+/)
        .filter((w: string) => w.length >= 3 && !STOP_WORDS.has(w) && !dList.includes(w));

      for (const w of words) {
        if (!currentToken || w.startsWith(currentToken)) {
          wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
        }
      }
    }

    // Insertar dominios filtrados
    Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([domain, count]) => {
        suggestions.push({
          id: `base-dom-${domain}`,
          title: domain,
          subtitle: `${sc.pathLabel} · dominio completo · aparece ${count}x`,
          query: domain,
          kind: "Domain",
          count,
        });
      });

    // Insertar topics
    Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([word, count]) => {
        suggestions.push({
          id: `base-word-${word}`,
          title: word,
          subtitle: `${sc.pathLabel} · aparece ${count}x`,
          query: word,
          kind: "Topic",
          count,
        });
      });

    const saved = customSavedSearches.filter((s) => s.toLowerCase().includes(lowerQ));

    return {
      headerText: `Sugerencias de ${sc.pathLabel}`,
      suggestions,
      savedSearches: saved,
      hintText: `Filtrando en ${sc.pathLabel} · Haz clic en una sugerencia para autocompletar`,
    };
  }

  // 3. Búsqueda global general (sin base específica)
  const domainCounts = new Map<string, number>();
  const wordCounts = new Map<string, number>();
  const currentToken = (rawQ.split(/\s+/).pop() || "").toLowerCase();

  const matchingRows = searchIndex.filter((row) => {
    const text = `${row.name || ""} ${row.path || ""} ${row.sourceName || ""}`.toLowerCase();
    return text.includes(lowerQ);
  });

  for (const row of matchingRows.slice(0, 200)) {
    const name = row.name || "";
    const dList = extractPredictiveDomains(name);
    for (const d of dList) {
      if (!currentToken || d.includes(currentToken)) {
        domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
      }
    }

    const words = name
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúüñ\.\-\s]/g, " ")
      .split(/\s+/)
      .filter((w: string) => w.length >= 3 && !STOP_WORDS.has(w) && !dList.includes(w));

    for (const w of words) {
      if (!currentToken || w.startsWith(currentToken)) {
        wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
      }
    }
  }

  Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([domain, count]) => {
      suggestions.push({
        id: `glob-dom-${domain}`,
        title: domain,
        subtitle: `Dominio completo · aparece ${count}x`,
        query: domain,
        kind: "Domain",
        count,
      });
    });

  Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([word, count]) => {
      suggestions.push({
        id: `glob-word-${word}`,
        title: word,
        subtitle: `Sugerencia · aparece ${count}x`,
        query: word,
        kind: "Topic",
        count,
      });
    });

  const saved = customSavedSearches.filter((s) => s.toLowerCase().includes(lowerQ));

  return {
    headerText: "Búsquedas rápidas",
    suggestions,
    savedSearches: saved,
    hintText: "Escribe zrevision, zclientes, zdominios, zproyectos, zpagar o zcorreos · Clic para agregar",
  };
}

export function mergePredictiveQuery(currentQuery: string, termToInsert: string, kind: string): string {
  const current = (currentQuery || "").trim();
  const insert = (termToInsert || "").trim();

  if (!insert) return current;
  if (!current) return kind === "Base" ? `${insert} ` : insert;

  if (kind === "Base") {
    // Si ya empieza con una base previa o parcial, reemplazarla
    const scope = resolveNotionBaseScope(current);
    if (scope.hasBase) {
      return scope.remainder ? `${insert} ${scope.remainder}` : `${insert} `;
    }
    const tokens = current.split(/\s+/);
    if (tokens[0].startsWith("z")) {
      tokens[0] = insert;
      return tokens.join(" ") + " ";
    }
    return `${insert} ${current}`;
  }

  // Si es un dominio o topic:
  const tokens = current.split(/\s+/);
  const lastToken = tokens[tokens.length - 1];

  // Si la última palabra escrita es un prefijo de la sugerencia (e.g. "cumb" -> "cumbreseguros.com")
  if (
    lastToken &&
    lastToken.length >= 2 &&
    insert.toLowerCase().startsWith(lastToken.toLowerCase())
  ) {
    tokens[tokens.length - 1] = insert;
    return tokens.join(" ");
  }

  // Si ya contiene el término exactamente, no duplicar
  if (tokens.some((t) => t.toLowerCase() === insert.toLowerCase())) {
    return current;
  }

  return `${current} ${insert}`;
}
