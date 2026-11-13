import { indexedContentText } from '../services/advancedQuery';
import {matchesSearchDatabase} from './searchDatabase';
import { isNotionViewItem, isTemplateItem } from './notionViewsCatalog';
import { ResultItem } from "@/components/ResultsViewHost/ResultsVirtualTable";

export function isNotionItem(x: ResultItem): boolean {
  if (!x) return false;
  const s = String(x.source || "").toLowerCase();
  const src = (x.sourceName || (x as any).externalSourceName || "").toLowerCase();
  const t = String(x.type || "").toUpperCase();
  const p = (x.path || x.target || "").toLowerCase();

  // Si es explícitamente Dropbox o es archivo/carpeta pura de Dropbox, NO es Notion
  if (s === "dropbox" || src === "dropbox" || (x as any).source === 1 || t === "FILE" || t === "FOLDER" || isLegacyDropboxDiskItem(x)) {
    return false;
  }

  return (
    s === "notion" ||
    (x as any).source === 2 ||
    t === "PAGE" ||
    t === "NOTION_PAGE" ||
    p.includes("notion.so") ||
    p.includes("notion.com") ||
    src.includes("revision") ||
    src.includes("cliente") ||
    src.includes("dominio") ||
    src.includes("programa") ||
    src.includes("proyecto") ||
    src.includes("cobrar") ||
    src.includes("pagar") ||
    src.includes("correo")
  );
}

export function isDropboxItem(x: ResultItem): boolean {
  if (!x) return false;
  // Una página de Notion jamás debe ser clasificada como Dropbox por tener "dropbox" en el título
  if (isNotionItem(x)) return false;

  const s = String(x.source || "").toLowerCase();
  const src = (x.sourceName || (x as any).externalSourceName || "").toLowerCase();
  const t = String(x.type || "").toUpperCase();
  const p = (x.path || x.target || "").toLowerCase();

  return (
    s === "dropbox" ||
    (x as any).source === 1 ||
    src === "dropbox" ||
    t === "FILE" ||
    t === "FOLDER" ||
    ((p.startsWith("/") || p.includes("\\drx\\") || p.includes("/drx/")) && !p.includes("notion.so"))
  );
}

export function isLegacyDropboxDiskItem(item: ResultItem): boolean {
  const location = String(item.path || item.target || "").trim();
  const absoluteDiskPath = /^[a-z]:[\\/]|^\\\\|^file:\/\//i.test(location);
  return absoluteDiskPath && isDropboxItem(item);
}

export function isContentItem(item: ResultItem): boolean {
  if (!item || item.isFolder || item.type?.toUpperCase() === "FOLDER" || isLegacyDropboxDiskItem(item)) {
    return false;
  }
  return Boolean(
    indexedContentText(item) ||
    item.aiContent ||
    (item as any)['busqueda palabras por contenido pagina IA'] ||
    (item as any)['busqueda palabras por contenido pagina ia'] ||
    (item as any)['búsqueda palabras por contenido página IA'] ||
    (item as any)['Búsqueda palabras por contenido pagina'] ||
    (item as any)['busqueda palabras por contenido pagina'] ||
    item.contentSnippet ||
    item.pageContent ||
    item.description
  );
}

function fromBase(item:ResultItem,source:RegExp,legacy:RegExp){
 if(!isNotionItem(item))return false;
 const indexed=String(item.sourceName||(item as any).externalSourceName||'').trim();
 return indexed?source.test(indexed):legacy.test(String(item.name||''));
}

export function filterByNotionBase(items: ResultItem[], baseTag: string): ResultItem[] {
  if (!baseTag || baseTag === "all" || baseTag === "" || baseTag.toLowerCase() === "todo") {
    return items;
  }

  if(baseTag.startsWith('base:'))return items.filter(x=>isNotionItem(x)&&matchesSearchDatabase(x,baseTag));
  const tag = baseTag.toLowerCase().trim();

  switch (tag) {
    case "notion":
    case "todas bases":
      return items.filter(isNotionItem);

    case "dropbox":
      return items.filter(isDropboxItem);

    case "carpetas":
      return items.filter((x) => !!(x.isFolder || x.type === "FOLDER" || x.type === "folder"));

    case "favoritos":
      return items.filter((x) => !!(x.isBookmarked || x.isChecked));

    case "contenido":
      return items.filter(isContentItem);

    case "revisiones":
      return items.filter(x=>fromBase(x,/revision/i,/^\[revisiones\]/i));
    case "zclientes":
    case "clientes":
      return items.filter(x=>fromBase(x,/cliente/i,/^\[clientes|\bzclientes?\b/i));
    case "zdominios":
    case "dominios":
      return items.filter(x=>fromBase(x,/dominio/i,/^\[dominios|\bzdominios?\b/i));
    case "zproyectos":
    case "proyectos":
      return items.filter(x=>fromBase(x,/programa|proyecto/i,/^\[(?:programas|proyectos)|\bzproyectos?\b/i));

    case "software":
    case "programas":
    case "zprogramas":
      return items.filter(x=>{
        if(!isNotionItem(x))return false;
        const src=String(x.sourceName||(x as any).externalSourceName||'').toLowerCase(),name=String(x.name||'').toLowerCase();
        const revisions=src?src.includes('revision'):/^\[revisiones\]/i.test(name);
        return revisions&&/(?:\bpprog\b|\bsoftware\b|\bdesarrollo\b|\.prog\b|\bzs\b|\bprogramas?\b)/i.test(name);
      });

    case "plantillas":
      return items.filter(x => isNotionItem(x) && isTemplateItem(x));
    case "vistas":
      return items.filter(x => isNotionItem(x) && isNotionViewItem(x));

    case "zpagar":
      return items.filter((x) => {
        if (!isNotionItem(x)) return false;
        const src = (x.sourceName || (x as any).externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return (
          (src.includes("pagar") || src.includes("cobrar y pagar") || src.includes("revision")) &&
          (name.includes("pagar") || name.includes("zpagar") || name.includes("pago"))
        );
      });

    case "zcobrar":
      return items.filter((x) => {
        if (!isNotionItem(x)) return false;
        const src = (x.sourceName || (x as any).externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return (
          (src.includes("cobrar") || src.includes("cobrar y pagar") || src.includes("revision")) &&
          (name.includes("cobrar") || name.includes("zcobrar") || name.includes("cobro"))
        );
      });

    case "zcorreos":
    case "correos":
      return items.filter(x=>fromBase(x,/correo/i,/^\[correos|\bzcorreos?\b/i));

    default:
      return items.filter((x) => {
        const src = (x.sourceName || (x as any).externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return src.includes(tag) || name.includes(tag);
      });
  }
}
