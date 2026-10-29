import {matchesSearchDatabase} from './searchDatabase';
import { ResultItem } from "@/components/ResultsViewHost/ResultsVirtualTable";

export function isNotionItem(x: ResultItem): boolean {
  const s = String(x.source || "").toLowerCase();
  const src = (x.sourceName || (x as any).externalSourceName || "").toLowerCase();
  const p = (x.path || x.target || "").toLowerCase();

  // Si es Dropbox o ruta de disco de dropbox, NO es Notion
  if (s === "dropbox" || src === "dropbox" || p.includes("dropbox") || p.includes("c:\\")) {
    return false;
  }

  return (
    s === "notion" ||
    (x as any).source === 2 ||
    p.includes("notion.so") ||
    p.includes("notion.com") ||
    (x.type || "").toUpperCase() === "PAGE" ||
    (x.type || "").toUpperCase() === "NOTION_PAGE" ||
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
  const s = String(x.source || "").toLowerCase();
  const src = (x.sourceName || (x as any).externalSourceName || "").toLowerCase();
  const p = (x.path || x.target || "").toLowerCase();
  return s === "dropbox" || (x as any).source === 1 || src === "dropbox" || p.includes("dropbox");
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
      return items.filter((x) => {
        return (
          !!(x.contentSnippet || x.description || (x as any).pageContent || (x as any).SearchText)
        );
      });

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
