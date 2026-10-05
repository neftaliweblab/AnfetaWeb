import { SearchResultRow } from '@/types/anfeta';

export interface QueryPlan {
  sorts: Array<{ field: string; desc: boolean }>;
  limit?: number;
  page?: number;
  extList: string[];
  onlyFolders?: boolean;
  folderContains?: string;
  noPath: string[];
}

export type QNode =
  | { type: 'AND'; left: QNode; right: QNode }
  | { type: 'OR'; left: QNode; right: QNode }
  | { type: 'NOT'; child: QNode }
  | { type: 'TEXT'; pattern: string }
  | { type: 'FIELD'; field: string; op: 'EQ' | 'CMP' | 'RANGE'; valA: string; valB?: string; cmp?: string }
  | { type: 'REGEX'; raw: string; regex: RegExp | null };

const IMG_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'heic', 'svg', 'tif', 'tiff', 'ico'];

export class AdvancedQueryV3 {
  public static parse(input: string): { plan: QueryPlan; expr: QNode | null } {
    const raw = (input || '').trim();
    if (!raw) {
      return {
        plan: { sorts: [], extList: [], noPath: [] },
        expr: null,
      };
    }

    const plan: QueryPlan = {
      sorts: [],
      extList: [],
      noPath: [],
    };

    // Extract special tokens like nopath:, ext:, folder:, type:
    // and replace pipe syntax: pdf|docx|xlsx -> (ext:pdf OR ext:docx OR ext:xlsx)
    const tokens = this.tokenize(raw);
    const filterTokens: string[] = [];

    for (const token of tokens) {
      const lower = token.toLowerCase();

      if (lower.startsWith('nopath:')) {
        const val = token.slice(7).trim();
        if (val) plan.noPath.push(val);
      } else if (lower.startsWith('ext:')) {
        const val = lower.slice(4).trim();
        if (val === 'img') {
          plan.extList.push(...IMG_EXTENSIONS);
        } else {
          val.split(';').forEach(e => {
            const clean = e.trim().replace(/^\./, '');
            if (clean) plan.extList.push(clean);
          });
        }
      } else if (lower.startsWith('.') && lower.length > 1 && !lower.includes(' ')) {
        // e.g. .pdf
        plan.extList.push(lower.slice(1));
      } else if (lower.startsWith('type:folder')) {
        plan.onlyFolders = true;
      } else if (lower.startsWith('type:file')) {
        plan.onlyFolders = false;
      } else if (lower.startsWith('folder:')) {
        plan.folderContains = token.slice(7);
      } else {
        filterTokens.push(token);
      }
    }

    const expr = this.buildAst(filterTokens);
    return { plan, expr };
  }

  private static tokenize(input: string): string[] {
    const tokens: string[] = [];
    const regex = /"([^"]+)"|(\([^)]+\))|(\S+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      if (match[1]) {
        // Quoted phrase
        tokens.push(`"${match[1]}"`);
      } else if (match[2]) {
        // Parenthesized
        tokens.push(match[2]);
      } else if (match[3]) {
        tokens.push(match[3]);
      }
    }
    return tokens;
  }

  private static buildAst(tokens: string[]): QNode | null {
    if (tokens.length === 0) return null;

    const terms: QNode[] = [];

    for (const t of tokens) {
      // Check negation prefix: -term or !term
      if ((t.startsWith('-') || t.startsWith('!')) && t.length > 1) {
        const inner = this.createTermNode(t.slice(1));
        terms.push({ type: 'NOT', child: inner });
        continue;
      }

      // Check pipe expansion: term1|term2
      if (t.includes('|') && !t.startsWith('"')) {
        const parts = t.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
          let orNode: QNode = this.createTermNode(parts[0]);
          for (let i = 1; i < parts.length; i++) {
            orNode = { type: 'OR', left: orNode, right: this.createTermNode(parts[i]) };
          }
          terms.push(orNode);
          continue;
        }
      }

      terms.push(this.createTermNode(t));
    }

    if (terms.length === 1) return terms[0];

    // Combine with AND by default
    let root: QNode = terms[0];
    for (let i = 1; i < terms.length; i++) {
      root = { type: 'AND', left: root, right: terms[i] };
    }
    return root;
  }

  private static createTermNode(token: string): QNode {
    const clean = token.replace(/^"(.*)"$/, '$1');

    if (clean.toLowerCase().startsWith('regex:')) {
      const rawPattern = clean.slice(6);
      try {
        const compiled = new RegExp(rawPattern, 'i');
        return { type: 'REGEX', raw: rawPattern, regex: compiled };
      } catch {
        return { type: 'REGEX', raw: rawPattern, regex: null };
      }
    }

    // Size filter: size:>10MB
    const sizeMatch = clean.match(/^size:([<>=!]+)?(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
    if (sizeMatch) {
      const cmp = sizeMatch[1] || '>=';
      const num = parseFloat(sizeMatch[2]);
      const unit = (sizeMatch[3] || 'MB').toUpperCase();
      const mult = unit === 'GB' ? 1073741824 : unit === 'MB' ? 1048576 : unit === 'KB' ? 1024 : 1;
      return {
        type: 'FIELD',
        field: 'size',
        op: 'CMP',
        cmp,
        valA: (num * mult).toString(),
      };
    }

    // Days modified filter: dm:<14
    const dmMatch = clean.match(/^dm:([<>=!]+)?(\d+)$/i);
    if (dmMatch) {
      return {
        type: 'FIELD',
        field: 'daysModified',
        op: 'CMP',
        cmp: dmMatch[1] || '<=',
        valA: dmMatch[2],
      };
    }

    return { type: 'TEXT', pattern: clean };
  }

  public static evaluate(item: SearchResultRow, plan: QueryPlan, expr: QNode | null): boolean {
    // 1. Evaluate Plan Restrictions
    if (plan.noPath.length > 0) {
      const pathLower = (item.path || '').toLowerCase();
      for (const np of plan.noPath) {
        if (pathLower.includes(np.toLowerCase())) return false;
      }
    }

    if (plan.extList.length > 0) {
      const itemExt = (item.extension || '').replace(/^\./, '').toLowerCase();
      if (!plan.extList.includes(itemExt)) return false;
    }

    if (plan.onlyFolders === true && item.extension !== 'FOLDER') return false;
    if (plan.onlyFolders === false && item.extension === 'FOLDER') return false;

    if (plan.folderContains) {
      const folderLower = (item.folder || '').toLowerCase();
      if (!folderLower.includes(plan.folderContains.toLowerCase())) return false;
    }

    // 2. Evaluate AST Expression
    if (!expr) return true;
    return this.evaluateNode(expr, item);
  }

  private static evaluateNode(node: QNode, item: SearchResultRow): boolean {
    switch (node.type) {
      case 'AND':
        return this.evaluateNode(node.left, item) && this.evaluateNode(node.right, item);

      case 'OR':
        return this.evaluateNode(node.left, item) || this.evaluateNode(node.right, item);

      case 'NOT':
        return !this.evaluateNode(node.child, item);

      case 'REGEX':
        if (!node.regex) return false;
        return node.regex.test(item.name) || node.regex.test(item.path);

      case 'TEXT':
        return this.wildcardMatch(item.name, node.pattern) || 
               this.wildcardMatch(item.path, node.pattern) ||
               (item.description ? this.wildcardMatch(item.description, node.pattern) : false) ||
               (item.pageContent ? this.wildcardMatch(item.pageContent, node.pattern) : false);

      case 'FIELD':
        if (node.field === 'size') {
          const itemSize = item.sizeBytes || 0;
          const target = parseFloat(node.valA);
          return this.compare(itemSize, target, node.cmp || '>=');
        }
        if (node.field === 'daysModified') {
          const itemDm = item.daysModified || 0;
          const target = parseInt(node.valA, 10);
          return this.compare(itemDm, target, node.cmp || '<=');
        }
        return true;
    }
  }

  private static wildcardMatch(text: string, pattern: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    const p = pattern.toLowerCase();

    if (!p.includes('*')) {
      return t.includes(p);
    }

    // Convert glob to regex
    const regexPattern = '^' + p.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*') + '$';
    try {
      return new RegExp(regexPattern, 'i').test(text);
    } catch {
      return t.includes(p.replace(/\*/g, ''));
    }
  }

  private static compare(a: number, b: number, cmp: string): boolean {
    switch (cmp) {
      case '>': return a > b;
      case '>=': return a >= b;
      case '<': return a < b;
      case '<=': return a <= b;
      case '=':
      case '==': return a === b;
      case '!=': return a !== b;
      default: return a >= b;
    }
  }
}

export function parseAdvancedQuery(input: string): { plan: QueryPlan; expr: QNode | null } {
  return AdvancedQueryV3.parse(input);
}

export function evaluateQueryAST(
  item: SearchResultRow,
  parsed: { plan: QueryPlan; expr: QNode | null }
): boolean {
  return AdvancedQueryV3.evaluate(item, parsed.plan, parsed.expr);
}

/**
 * Motor de búsqueda flexible por tokens y comillas (Paridad 1:1 con MatchesFlexibleOrQuotedQuery de ANFETA WinUI 3).
 * Soporta:
 * - Tokens AND en cualquier orden (ej: "sseo mes SSEPT SEO Optimización Técnica seo. bria ggena")
 * - Búsqueda por ID directo / UUID de Notion
 * - Descomposición de prefijos de dominio (ads.dominio.com, seo.dominio.com, tzp.maps...)
 * - Normalización de caracteres conectores (. - _ /)
 * - Filtros rápidos: ext:pdf, folder:dropbox, type:folder, type:file, -negacion
 * - Frases exactas entre comillas: "frase exacta"
 */
export function matchesFlexibleOrQuotedQuery(
  item: SearchResultRow,
  query: string
): boolean {
  const q = (query || "").trim();
  if (!q) return true;

  // Normalización inteligente de queries compuestos en español / ANFETA (ej. "z programas" -> "zprogramas")
  let normalizedQ = q
    .replace(/\bz\s+(programas?|proyectos?|clientes?|dominios?|correos?|pagar|cobrar|revision(?:es)?)\b/gi, "z$1")
    .trim();

  // 1. Coincidencia directa por ID o UUID de Notion
  const rawId = (item.id || "").replace(/-/g, "").toLowerCase();
  const rawExtId = ((item as any).externalId || "").replace(/-/g, "").toLowerCase();
  const cleanQ = normalizedQ.replace(/-/g, "").toLowerCase();
  if (cleanQ.length >= 8 && (rawId === cleanQ || rawExtId === cleanQ)) {
    return true;
  }

  // 2. Construcción de searchable concatenando todos los metadatos relevantes
  const searchable = [
    item.name,
    item.displayName,
    item.domainChip,
    item.areaChip,
    item.displayLocation,
    item.target,
    item.path,
    (item as any).pathColumn,
    item.searchText,
    item.description,
    (item as any).contentSnippet,
    (item as any).pageContent,
    item.projectUpdateStatus,
    item.status,
    item.scheduledDate,
    item.externalSourceName,
    item.sourceName,
    item.source,
    item.assignedPerson,
    ...(item.assignmentKeys || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const searchableWithSpaces = searchable.replace(/[.\-_/]/g, " ");
  // Versión compacta: "Pre proyecto" ≈ "PreProyecto", "26-[09SEP]" ≈ "2609SEP"
  const searchableCompact = searchable.replace(/[\s.\-_/()[\]]+/g, "");

  // 3. Tokenización flexible respetando comillas y signos de negación
  const tokens: Array<{ value: string; isExact: boolean; isNegated: boolean }> = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalizedQ)) !== null) {
    if (match[1]) {
      tokens.push({ value: match[1], isExact: true, isNegated: false });
    } else if (match[2]) {
      let val = match[2];
      let isNegated = false;
      if ((val.startsWith("-") || val.startsWith("!")) && val.length > 1) {
        isNegated = true;
        val = val.slice(1);
      }
      tokens.push({ value: val, isExact: false, isNegated });
    }
  }

  if (tokens.length === 0) return true;

  return tokens.every((token) => {
    const valLow = token.value.toLowerCase();

    // Filtro por extensión (ej. ext:pdf, ext:img)
    if (valLow.startsWith("ext:") && !token.isExact) {
      const extWant = valLow.slice(4).replace(/^\./, "");
      const itemExt = (item.extension || "").toLowerCase().replace(/^\./, "");
      const extMatch =
        extWant === "img"
          ? ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].includes(itemExt)
          : itemExt === extWant;
      return token.isNegated ? !extMatch : extMatch;
    }

    // Filtro por carpeta (ej. folder:dropbox, folder:agape)
    if (valLow.startsWith("folder:") && !token.isExact) {
      const fWant = valLow.slice(7).toLowerCase().trim();
      const folderVal = (
        ((item as any).folder || "") +
        " " +
        (item.target || "") +
        " " +
        (item.path || "") +
        " " +
        (item.name || "")
      ).toLowerCase();
      const fMatch = folderVal.includes(fWant);
      return token.isNegated ? !fMatch : fMatch;
    }

    // Filtros de tipo: folder / file
    if (valLow === "type:folder" && !token.isExact) {
      const isFolder = item.isFolder || item.extension === "FOLDER" || item.type === "FOLDER";
      return token.isNegated ? !isFolder : isFolder;
    }
    if (valLow === "type:file" && !token.isExact) {
      const isFile = !item.isFolder && item.extension !== "FOLDER" && item.type !== "FOLDER";
      return token.isNegated ? !isFile : isFile;
    }

    // Frase exacta entre comillas
    if (token.isExact) {
      const hasExact = searchable.includes(valLow);
      return token.isNegated ? !hasExact : hasExact;
    }

    // Descomposición de prefijo operativo (ej. seo.tornillosam.com -> seo + tornillosam.com)
    const pfxMatch = valLow.match(
      /^(tzp|tzs|ads|aads|seo|sseo|webs?|wwebs|maps?|mmaps|app|apli|aapli|software|prog|pprog|coti|cotizacion|cotización|redes|rrede|disen[oó]|diseñ[oó]|ddise)\.(.+)$/i
    );
    const subParts = pfxMatch ? [pfxMatch[1], pfxMatch[2]] : [valLow];

    for (const sp of subParts) {
      const cleanSp = sp.replace(/^\.+|\.+$/g, "");
      if (!cleanSp) continue;

      const srcName = (
        (item.sourceName || (item as any).externalSourceName || "") +
        " " +
        (item.source || "")
      ).toLowerCase();

      let has =
        searchable.includes(cleanSp) ||
        searchableWithSpaces.includes(cleanSp) ||
        (cleanSp.length >= 4 &&
          searchableCompact.includes(cleanSp.replace(/[\s.\-_/()[\]]+/g, "")));

      if (!has) {
        // Alias y equivalencias automáticas de ANFETA
        if (cleanSp === "zproyectos" || cleanSp === "zproyecto" || cleanSp === "proyectos" || cleanSp === "proyecto") {
          has =
            searchable.includes("zproyecto") ||
            searchable.includes("zproyectos") ||
            (srcName.includes("programa") && searchable.includes("proyecto")) ||
            searchable.includes("[programas y proyectos]");
        } else if (cleanSp === "programas" || cleanSp === "programa" || cleanSp === "pprog" || cleanSp === "zprogramas" || cleanSp === "zprograma") {
          has =
            srcName.includes("programa") ||
            searchable.includes("programas y proyectos") ||
            searchable.includes("pprog") ||
            searchable.includes("programa") ||
            searchable.includes("software") ||
            searchable.includes("ssoft");
        } else if (cleanSp === "zclientes" || cleanSp === "zcliente" || cleanSp === "clientes" || cleanSp === "cliente") {
          has =
            srcName.includes("cliente") ||
            searchable.includes("zcliente") ||
            searchable.includes("cliente") ||
            searchable.includes("[clientes");
        } else if (cleanSp === "zdominios" || cleanSp === "zdominio" || cleanSp === "dominios" || cleanSp === "dominio") {
          has =
            srcName.includes("dominio") ||
            searchable.includes("zdominio") ||
            searchable.includes("dominio") ||
            searchable.includes("[dominios");
        } else if (cleanSp === "zcorreos" || cleanSp === "zcorreo" || cleanSp === "correos" || cleanSp === "correo") {
          has =
            srcName.includes("correo") ||
            searchable.includes("correos contraseñas") ||
            searchable.includes("ccorr") ||
            searchable.includes("zcorreo") ||
            searchable.includes("correo") ||
            searchable.includes("@");
        } else if (cleanSp === "zpagar" || cleanSp === "pagar") {
          has = searchable.includes("pagar") || srcName.includes("pagar");
        } else if (cleanSp === "zcobrar" || cleanSp === "cobrar") {
          has = searchable.includes("cobrar") || srcName.includes("cobrar");
        } else if (cleanSp === "revisiones" || cleanSp === "revision" || cleanSp === "prtuzrevision" || cleanSp === "rtuzrevision" || cleanSp === "zrevision") {
          has =
            srcName.includes("revision") ||
            searchable.includes("revision") ||
            searchable.includes("rtuzrevision") ||
            searchable.includes("prtuzrevision");
        } else if (cleanSp === "z") {
          has =
            searchable.includes("zproyecto") ||
            searchable.includes("zcliente") ||
            searchable.includes("zdominio") ||
            searchable.includes("zpagar") ||
            searchable.includes("zcobrar") ||
            searchable.includes("zrevision") ||
            searchable.includes("[programas") ||
            searchable.includes("[clientes") ||
            searchable.includes("[dominios") ||
            searchable.includes("[cobrar");
        } else if (cleanSp === "nneft" || cleanSp === "nnetf" || cleanSp === "neftali" || cleanSp === "neft") {
          has =
            searchable.includes("neftali") ||
            searchable.includes("nneft") ||
            searchable.includes("nnetf") ||
            searchable.includes("neft");
        } else if (cleanSp === "jjohn" || cleanSp === "john") {
          has = searchable.includes("john") || searchable.includes("jjohn");
        } else if (cleanSp === "kkarl" || cleanSp === "karla" || cleanSp === "karl") {
          has = searchable.includes("karla") || searchable.includes("kkarl") || searchable.includes("karl");
        } else if (cleanSp === "bbria" || cleanSp === "brian") {
          has = searchable.includes("brian") || searchable.includes("bbria");
        } else if (cleanSp === "ggena" || cleanSp === "genaro") {
          has = searchable.includes("genaro") || searchable.includes("ggena");
        } else if (cleanSp === "iisai" || cleanSp === "isai" || cleanSp === "isaias" || cleanSp === "iisaia") {
          has = searchable.includes("isaias") || searchable.includes("isai") || searchable.includes("iisai") || searchable.includes("iisaia");
        } else if (cleanSp === "ssote" || cleanSp === "sotelo") {
          has = searchable.includes("sotelo") || searchable.includes("ssote");
        } else if (cleanSp === "aacal" || cleanSp === "acalli") {
          has = searchable.includes("acalli") || searchable.includes("aacal");
        } else if (cleanSp === "aandr" || cleanSp === "andrade") {
          has = searchable.includes("andrade") || searchable.includes("aandr");
        } else if (cleanSp === "eemma" || cleanSp === "eedua" || cleanSp === "emmanuel" || cleanSp === "eduardo") {
          has = searchable.includes("emmanuel") || searchable.includes("eduardo") || searchable.includes("eemma") || searchable.includes("eedua");
        }
      }

      if (token.isNegated ? has : !has) return false;
    }

    return true;
  });
}
