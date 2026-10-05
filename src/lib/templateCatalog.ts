/**
 * templateCatalog.ts
 * Catálogo y utilidades de Plantillas Fase1 para ANFETA.
 * Paridad 1:1 con NotionTemplateCatalogService.cs y SearchView.Calendar.cs de WinUI 3.
 */

export interface CalendarQuickTemplateDefinition {
  key: string;
  label: string;
  projectToken: string;
  icon: string;
  defaultDurationMinutes: number;
  hint: string;
  sourceUrl?: string;
  subOptions?: Array<{ label: string; token: string; icon: string }>;
}

export const CALENDAR_TEMPLATE_HUB_URL =
  "https://app.notion.com/p/393abd7d91b7804993bdd14809e1b27b?v=393abd7d91b7804aae7a000cb9486782&source=copy_link";

export const CALENDAR_QUICK_TEMPLATES: CalendarQuickTemplateDefinition[] = [
  {
    key: "todos",
    label: "Todas",
    projectToken: "",
    icon: "📋",
    defaultDurationMinutes: 60,
    hint: "Catálogo completo de Plantilla Fase1.",
  },
  {
    key: "actividad-rapida",
    label: "Actividad rápida",
    projectToken: "rrapi",
    icon: "⚡",
    defaultDurationMinutes: 60,
    hint: "Plantillas para crear actividades rápidas.",
    sourceUrl: "https://app.notion.com/p/393abd7d91b7804993bdd14809e1b27b?v=393abd7d91b7803e9921000c068624c5&source=copy_link",
  },
  {
    key: "cliente",
    label: "Cliente",
    projectToken: "cclien",
    icon: "👤",
    defaultDurationMinutes: 60,
    hint: "Plantillas de información y pendientes del cliente.",
    sourceUrl: CALENDAR_TEMPLATE_HUB_URL,
  },
  {
    key: "acceso-correo",
    label: "Crear acceso correo",
    projectToken: "aacce-ccorre",
    icon: "✉️",
    defaultDurationMinutes: 30,
    hint: "Plantilla para documentar acceso y contraseña de correo.",
    sourceUrl: "https://app.notion.com/p/correo-midominio-com-dominio-ttags-Acceso-correo-aacce-ccorr-3c8abd7d91b780179ec9c7dde93fd335?v=2f1abd7d91b7812ba58a000cbcead7ad&source=copy_link",
  },
  {
    key: "acceso-dominio",
    label: "Crear acceso dominio",
    projectToken: "aacce-ddomi",
    icon: "🌐",
    defaultDurationMinutes: 30,
    hint: "Plantilla para documentar acceso y contraseña de dominio.",
    sourceUrl: "https://app.notion.com/p/aprtuzDOMINIO-dominio-com-acceso-contrase-a-aacce-ccont-wword-o-hhost-o-ssite-o-ccpane-ddomi-39eabd7d91b780aa86f0f02f60887f12?source=copy_link",
  },
  {
    key: "cotizacion",
    label: "Cotización",
    projectToken: "ccoti",
    icon: "📑",
    defaultDurationMinutes: 60,
    hint: "Plantilla para cotización por etapas.",
    sourceUrl: "https://app.notion.com/p/prtUzREVISION-ccoti-26-08AGO-Cotizacion-Etapas-dominio-com-n-neft-k-karl-b-bria-g-gena-j-john-384abd7d91b780f99476d6d870ded108?source=copy_link",
  },
  {
    key: "web",
    label: "WEB",
    projectToken: "wwebs",
    icon: "💻",
    defaultDurationMinutes: 60,
    hint: "Plantillas reales para proyectos WEB.",
    sourceUrl: "https://app.notion.com/p/393abd7d91b7804993bdd14809e1b27b?v=393abd7d91b780869898000c6b7bfcea&source=copy_link",
  },
  {
    key: "seo",
    label: "SEO",
    projectToken: "sseo",
    icon: "🔍",
    defaultDurationMinutes: 60,
    hint: "Plantillas reales para proyectos SEO.",
    sourceUrl: "https://app.notion.com/p/393abd7d91b7804993bdd14809e1b27b?v=393abd7d91b7800bab7e000ce5ee4e1d&source=copy_link",
  },
  {
    key: "ads",
    label: "ADS",
    projectToken: "aads",
    icon: "🎯",
    defaultDurationMinutes: 60,
    hint: "Plantillas reales para proyectos ADS.",
    sourceUrl: "https://app.notion.com/p/393abd7d91b7804993bdd14809e1b27b?v=393abd7d91b7806182c8000c86c9b308&source=copy_link",
  },
  {
    key: "cobros",
    label: "Cobros",
    projectToken: "ccobr",
    icon: "💰",
    defaultDurationMinutes: 30,
    hint: "Plantillas reales de Cobros.",
    sourceUrl: "https://app.notion.com/p/393abd7d91b7804993bdd14809e1b27b?v=3aeabd7d91b780d4bbc4000c27a2ad82&source=copy_link",
  },
  {
    key: "maps",
    label: "MAPS",
    projectToken: "mmaps",
    icon: "📍",
    defaultDurationMinutes: 60,
    hint: "Plantillas reales para proyectos MAPS.",
    sourceUrl: CALENDAR_TEMPLATE_HUB_URL,
  },
  {
    key: "redes",
    label: "Redes Sociales",
    projectToken: "rrede",
    icon: "📣",
    defaultDurationMinutes: 60,
    hint: "Plantillas reales para proyectos de Redes Sociales.",
    sourceUrl: CALENDAR_TEMPLATE_HUB_URL,
    subOptions: [
      { label: "Todas las Redes", token: "rrede", icon: "🌐" },
      { label: "TikTok", token: "ttikt", icon: "🎵" },
      { label: "Instagram", token: "iinst", icon: "📸" },
      { label: "Facebook", token: "fface", icon: "📘" },
      { label: "LinkedIn", token: "llink", icon: "💼" },
    ],
  },
  {
    key: "aplicacion",
    label: "Aplicación",
    projectToken: "aapli",
    icon: "📱",
    defaultDurationMinutes: 60,
    hint: "Plantillas reales para proyectos de Aplicaciones / Software.",
    sourceUrl: CALENDAR_TEMPLATE_HUB_URL,
  },
  {
    key: "bibliotecas",
    label: "Bibliotecas",
    projectToken: "bbibl",
    icon: "📚",
    defaultDurationMinutes: 60,
    hint: "Plantillas reales de Bibliotecas.",
    sourceUrl: "https://app.notion.com/p/393abd7d91b7804993bdd14809e1b27b?v=393abd7d91b780209653000cd91dff96&source=copy_link",
  },
  {
    key: "programas",
    label: "Programas",
    projectToken: "pprog",
    icon: "⚙️",
    defaultDurationMinutes: 60,
    hint: "Plantilla Fase1 con el tag exacto pprog.",
    sourceUrl: CALENDAR_TEMPLATE_HUB_URL,
  },
];

/**
 * Limpia el título original técnico de Notion para mostrar un texto limpio y legible.
 * Ejemplo: "prtuzREVISION wwebs 26-[08AGO] 6.00 wwebs ttuto Sitio web no refleja..."
 * Retorna: "Sitio web no refleja los cambios realizados"
 */
export function cleanCalendarQuickTemplateActivityTitle(
  rawTitle: string,
  projectToken = ""
): string {
  let value = (rawTitle || "").trim().replace(/\s+/g, " ");
  if (!value) return "Actividad desde plantilla";

  // Quitar estados técnicos
  value = value.replace(/\b(?:a?prtuzrevision|sprtuzrevision|rtuzrevision|zrevision|zzz)\b/gi, " ");

  // Quitar token del proyecto si aplica
  if (projectToken) {
    const escaped = projectToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }

  // Quitar tokens técnicos de áreas
  value = value.replace(/\b(?:ccoti|coti|sseo|aads|wwebs|pprog|ddise|rrede|mmaps|bbibl)\b/gi, " ");

  // Quitar fechas y meses en corchetes: 26-[08AGO], 26-08AGO, etc.
  value = value.replace(/\b\d{2}-\[\d{2}[A-ZÁÉÍÓÚÑ]{3,4}\]|\b\d{2}-\d{2}[A-ZÁÉÍÓÚÑ]{3,4}\b|\(\s*\d{2,4}[A-ZÁÉÍÓÚÑ]{0,12}\s*\)/gi, " ");

  // Quitar órdenes de fase: 6.00, 20.00, mes 1.00, fase 2.03
  value = value.replace(/(?:mes|fase)?\s*\d{1,3}\.\d{1,3}\b|\b\d{2}-F\d{2}\b/gi, " ");
  value = value.replace(/\b(?:mes|fase)\b/gi, " ");

  // Quitar prefijos de tutorial y plantillas viejas: ttuto, ccach, aactu, ssiti, hhost, etc.
  value = value.replace(/\b(?:00rev\d*|00plantilla|00plant|00act\d*|ttuto|ccach|aactu|hhace|ccorr|ccorp|ssite|ggrou|ootor|hhost|hhostinger|ddivi|eelem|rresp|ssiti|pplan|ggoog|ppaso)\b/gi, " ");

  // Quitar tags de personas: n-neft, k-karl, b-bria, g-gena, j-john, etc.
  value = value.replace(/\b(?:[a-z]-[a-z0-9]+|[a-z]{1,2}\.[a-z0-9]+)\b/gi, " ");
  value = value.replace(/\b(?:nneft|kkarl|bbria|ggena|jjohn|iisaia|iisai|eedua|aacal|mmata|neft|karl|bria|gena|john|isai|edua|acal|andr|emma)\b/gi, " ");

  // Quitar dominios en corchetes de plantilla: [webs.dominio.com], [dominio.com]
  value = value.replace(/\[\s*(?:[a-z0-9_.-]+\.)*(?:dominio|midominio|ejemplo|[a-z0-9-]+)\.(?:com|com\.mx|mx|org|net)\s*\]/gi, " ");
  value = value.replace(/\b(?:dominio|midominio|ejemplo)\s+(?:com|com\.mx|mx|org|net)\b/gi, " ");

  // Limpiar corchetes vacíos y espacios
  value = value.replace(/\[\s*\]|\(\s*\)/g, " ");
  value = value.replace(/\s+/g, " ").trim().replace(/^[-·|\s]+|[-·|\s]+$/g, "");

  return value || "Actividad desde plantilla";
}

/**
 * Extrae el número de orden o fase de la plantilla (ej. "6.00", "20.00", "0.30").
 */
export function extractCalendarQuickTemplateOrder(title: string): string {
  if (!title) return "";
  const match = title.match(/(?:mes|fase)?\s*(\d{1,3}\.\d{1,3})/i);
  return match ? match[1].trim() : "";
}

/**
 * Extrae el dominio sugerido en corchetes si existe en el título de la plantilla.
 */
export function extractCalendarQuickTemplateDomain(title: string): string {
  if (!title) return "";
  const match = title.match(/\[\s*([a-z0-9_.-]+\.[a-z]{2,})\s*\]/i);
  if (match) return match[1].trim();

  const domainMatch = title.match(/\b([a-z0-9-]+\.(?:com\.mx|org\.mx|com|mx|org|net|io|app))\b/i);
  return domainMatch ? domainMatch[1].trim() : "";
}

/**
 * Genera el tag de mes según la convención de ANFETA: e.g. 26-[10OCT].
 */
export function buildCalendarTemplateMonthTag(date: Date): string {
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const abbr = months[date.getMonth()];
  return `${yy}-[${mm}${abbr}]`;
}

/**
 * Genera el tag corto del revisor según ANFETA.
 */
export function getCalendarReviewerTag(personName: string): string {
  const norm = (personName || "").trim().toLowerCase();
  switch (norm) {
    case "john":
      return "john";
    case "karla":
      return "karl";
    case "isaias":
      return "isai";
    case "sotelo":
      return "edua";
    case "acalli":
      return "acal";
    case "andrade":
      return "andr";
    case "brian":
      return "bria";
    case "genaro":
      return "gena";
    case "neftali":
      return "neft";
    default:
      return norm.slice(0, 4);
  }
}

/**
 * Genera el tag del responsable asignado (ej. n-neft, k-karl, etc.).
 */
export function getCalendarPersonTag(personName: string): string {
  const norm = (personName || "").trim().toLowerCase();
  switch (norm) {
    case "john":
      return "j-john";
    case "karla":
      return "k-karl";
    case "isaias":
      return "i-isai";
    case "sotelo":
      return "s-sote";
    case "acalli":
      return "a-acal";
    case "andrade":
      return "a-andr";
    case "brian":
      return "b-bria";
    case "genaro":
      return "g-gena";
    case "neftali":
      return "n-neft";
    default:
      return "";
  }
}

/**
 * Construye el título completo estandarizado para la nueva actividad de Notion/Calendario.
 * Formato: "prtuzREVISION wwebs 26-[10OCT] 6.00 Título [webs.dominio.com] n-neft john"
 */
export function buildCalendarQuickTemplateFinalTitle(params: {
  projectToken?: string;
  selectedDate: Date;
  orderToken?: string;
  description: string;
  domain?: string;
  personName?: string;
  reviewerName?: string;
  templateOriginalTitle?: string;
}): string {
  const {
    projectToken = "",
    selectedDate,
    orderToken = "",
    description,
    domain = "",
    personName = "",
    reviewerName = "",
    templateOriginalTitle = "",
  } = params;

  const monthTag = buildCalendarTemplateMonthTag(selectedDate);
  const cleanDom = domain.trim().replace(/^\[|\]$/g, "");

  let formattedDomain = "";
  if (cleanDom) {
    let prefix = "";
    if (projectToken) {
      const p = projectToken.toLowerCase();
      if (p.includes("seo")) prefix = "seo.";
      else if (p.includes("ads")) prefix = "ads.";
      else if (p.includes("web")) prefix = "webs.";
      else if (p.includes("coti")) prefix = "cotizacion.";
      else if (p.includes("map")) prefix = "maps.";
      else if (p.includes("red")) prefix = "redes.";
      else if (p.includes("apli")) prefix = "app.";
      else if (p.includes("prog")) prefix = "prog.";
      else if (p.includes("bibl")) prefix = "biblioteca.";
    }

    if (prefix && !cleanDom.toLowerCase().startsWith(prefix)) {
      formattedDomain = `[${prefix}${cleanDom}]`;
    } else {
      formattedDomain = `[${cleanDom}]`;
    }
  }

  const personTag = personName ? getCalendarPersonTag(personName) : "";
  const reviewerTag = reviewerName ? getCalendarReviewerTag(reviewerName) : "";

  // Conservar tags de equipo originales si no se eligieron personas específicas
  let teamTags = "";
  if (!personTag && !reviewerTag && templateOriginalTitle) {
    const teamMatch = templateOriginalTitle.match(/(?:\b[a-z]-[a-z0-9]+\s*)+$/i);
    if (teamMatch) teamTags = teamMatch[0].trim();
  }

  const parts = [
    "prtuzREVISION",
    projectToken,
    monthTag,
    orderToken,
    description,
    formattedDomain,
    personTag,
    reviewerTag,
    teamTags,
  ].filter(Boolean);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Filtra el catálogo de plantillas según la categoría seleccionada (tokens: wwebs, sseo, aads, etc.).
 */
export function filterTemplatesByCategory(
  templates: any[],
  categoryDef: CalendarQuickTemplateDefinition,
  searchQuery = ""
): any[] {
  let list = templates;

  if (categoryDef.key !== "todos" && categoryDef.projectToken) {
    const token = categoryDef.projectToken.toLowerCase();
    list = list.filter((item) => {
      const title = (item.Title || item.title || "").toLowerCase();
      if (token === "rrapi") {
        return /\[ttipo-actividad(?:-rrapi\s+rapido)?\]/i.test(title);
      }
      if (token === "aacce-ccorre") {
        return title.includes("aacce") && (title.includes("ccorr") || title.includes("ccorre"));
      }
      if (token === "aacce-ddomi") {
        return title.includes("aacce") && title.includes("ddomi");
      }
      if (token === "ccobr") {
        return title.includes("ccobr") || title.includes("cobro");
      }
      if (token === "rrede") {
        return (
          title.includes("rrede") ||
          title.includes("redes") ||
          title.includes("tiktok") ||
          title.includes("instagram") ||
          title.includes("facebook") ||
          title.includes("linkedin")
        );
      }
      return title.includes(token);
    });
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter((item) => {
      const title = (item.Title || item.title || "").toLowerCase();
      const pageId = (item.PageId || item.pageId || "").toLowerCase();
      return title.includes(q) || pageId.includes(q);
    });
  }

  // Ordenar numéricamente por orden si existe, luego por título
  return list.sort((a, b) => {
    const tA = a.Title || a.title || "";
    const tB = b.Title || b.title || "";
    const ordA = parseFloat(extractCalendarQuickTemplateOrder(tA)) || 999999;
    const ordB = parseFloat(extractCalendarQuickTemplateOrder(tB)) || 999999;
    if (ordA !== ordB) return ordA - ordB;
    return tA.localeCompare(tB);
  });
}
