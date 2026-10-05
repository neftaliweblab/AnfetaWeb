import { ResultItem } from "@/components/ResultsViewHost/ResultsVirtualTable";

export function filterByNotionBase(items: ResultItem[], baseTag: string): ResultItem[] {
  if (!baseTag || baseTag === "all" || baseTag === "" || baseTag.toLowerCase() === "todo") {
    return items;
  }

  const tag = baseTag.toLowerCase().trim();

  switch (tag) {
    case "notion":
    case "todas bases":
      return items.filter((x) => (x.source || "").toLowerCase() === "notion");

    case "dropbox":
      return items.filter((x) => {
        const s = (x.source || "").toLowerCase();
        const p = (x.path || x.target || "").toLowerCase();
        return s === "dropbox" || s === "local" || p.includes("dropbox");
      });

    case "carpetas":
      return items.filter((x) => !!(x.isFolder || x.type === "FOLDER" || x.type === "folder"));

    case "favoritos":
      return items.filter((x) => !!(x.isBookmarked || x.isChecked));

    case "contenido":
      return items.filter((x) => {
        const s = (x.source || "").toLowerCase();
        return (
          s === "notion" &&
          !!(x.contentSnippet || x.description || x.pageContent || (x as any).SearchText)
        );
      });

    case "revisiones":
      return items.filter((x) => {
        const s = (x.source || "").toLowerCase();
        if (s !== "notion") return false;
        const src = (x.sourceName || x.externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return src.includes("revision") || name.includes("[revisiones]") || name.includes("revision");
      });

    case "zclientes":
    case "clientes":
      return items.filter((x) => {
        const s = (x.source || "").toLowerCase();
        if (s !== "notion") return false;
        const src = (x.sourceName || x.externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return src.includes("cliente") || name.includes("[clientes") || name.includes("zclientes");
      });

    case "zdominios":
    case "dominios":
      return items.filter((x) => {
        const s = (x.source || "").toLowerCase();
        if (s !== "notion") return false;
        const src = (x.sourceName || x.externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return src.includes("dominio") || name.includes("[dominios") || name.includes("zdominios");
      });

    case "zproyectos":
    case "programas":
      return items.filter((x) => {
        const s = (x.source || "").toLowerCase();
        if (s !== "notion") return false;
        const src = (x.sourceName || x.externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return (
          src.includes("programa") ||
          src.includes("proyecto") ||
          name.includes("[programas") ||
          name.includes("zproyectos") ||
          name.includes("pprog")
        );
      });

    case "zpagar":
      return items.filter((x) => {
        const s = (x.source || "").toLowerCase();
        if (s !== "notion") return false;
        const src = (x.sourceName || x.externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return (src.includes("pagar") || src.includes("cobrar")) && name.includes("pagar");
      });

    case "zcobrar":
      return items.filter((x) => {
        const s = (x.source || "").toLowerCase();
        if (s !== "notion") return false;
        const src = (x.sourceName || x.externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return (src.includes("pagar") || src.includes("cobrar")) && name.includes("cobrar");
      });

    case "zcorreos":
      return items.filter((x) => {
        const s = (x.source || "").toLowerCase();
        if (s !== "notion") return false;
        const src = (x.sourceName || x.externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return src.includes("correo") || name.includes("[correos") || name.includes("zcorreos");
      });

    default:
      return items.filter((x) => {
        const src = (x.sourceName || x.externalSourceName || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        return src.includes(tag) || name.includes(tag);
      });
  }
}
