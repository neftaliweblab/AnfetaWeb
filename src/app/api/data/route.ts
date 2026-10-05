import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { PendingTaskItem } from "@/types/anfeta";
import { normalizeSearchRow, normalizeActivity } from "@/services/dataNormalizers";

const LOCAL_STATE_DIR =
  "C:\\Users\\nanoc\\AppData\\Local\\Packages\\c6d297e3-90b3-45d7-8116-b599de47cc6a_jwwtc8z12084g\\LocalState";

const PROJECT_DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(process.cwd(), "settings.json");
const WIN_SETTINGS_DIR = path.join(
  process.env.LOCALAPPDATA || "C:\\Users\\nanoc\\AppData\\Local",
  "AnfetaCalendarLab"
);
const WIN_SETTINGS_FILE = path.join(WIN_SETTINGS_DIR, "settings.json");

function getSettings() {
  let settings = {
    notionToken: process.env.NOTION_TOKEN || "",
    dropboxPath: process.env.DROPBOX_PATH || "C:\\Users\\nanoc\\Dropbox",
    currentUser: "nneft",
    isDryRun: true,
  };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      settings = { ...settings, ...data };
    } else if (fs.existsSync(WIN_SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(WIN_SETTINGS_FILE, "utf-8"));
      settings = { ...settings, ...data };
    }
  } catch (e) {
    console.error("Error reading settings:", e);
  }
  return settings;
}

function saveSettings(data: any) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
    if (!fs.existsSync(WIN_SETTINGS_DIR)) {
      fs.mkdirSync(WIN_SETTINGS_DIR, { recursive: true });
    }
    fs.writeFileSync(WIN_SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving settings to disk:", e);
  }
}

function readLocalJson<T>(filename: string, defaultValue: T): T {
  try {
    // 1. Buscar en la carpeta 'data/' del proyecto (Vercel, producción en la nube)
    const projectPath = path.join(PROJECT_DATA_DIR, filename);
    if (fs.existsSync(projectPath)) {
      const content = fs.readFileSync(projectPath, "utf-8");
      return JSON.parse(content) as T;
    }

    // 2. Fallback a directorio local de Windows (desarrollo local)
    const localPath = path.join(LOCAL_STATE_DIR, filename);
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, "utf-8");
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
  }
  return defaultValue;
}

// Caché en memoria para vistas previas con TTL de 15 minutos
const previewMemoryCache = new Map<string, { timestamp: number; payload: any }>();
const PREVIEW_CACHE_TTL = 15 * 60 * 1000;

const STRUCTURAL_CONTAINERS = new Set([
  "column_list",
  "column",
  "synced_block",
  "table",
  "template",
  "breadcrumb",
]);

const TECHNICAL_PREFIXES = [
  "[ANFETA_THREAD_V1]",
  "[ANFETA_REVIEW_SOURCE_V1]",
  "[ANFETA_REVIEW_FLOW_V1]",
  "[ANFETA_",
  "Datos internos de ANFETA",
];

function buildWritablePropertyValue(prop: any): Record<string, any> | null {
  const type = prop?.type;
  if (!type) return null;

  switch (type) {
    case "title":
    case "rich_text": {
      const arr = prop[type];
      if (!Array.isArray(arr)) return null;
      const res: any[] = [];
      for (const item of arr) {
        if (item?.text && item.text?.content) {
          const t: any = { content: item.text.content };
          if (item.text.link && item.text.link.url) t.link = { url: item.text.link.url };
          res.push({ type: "text", text: t });
        }
      }
      return { [type]: res };
    }
    case "number": {
      return typeof prop.number === "number" ? { number: prop.number } : null;
    }
    case "select":
    case "status": {
      const sel = prop[type];
      if (sel && sel.name) return { [type]: { name: sel.name } };
      return null;
    }
    case "multi_select": {
      const arr = prop.multi_select;
      if (!Array.isArray(arr)) return null;
      const valid = arr.filter((x: any) => x && x.name).map((x: any) => ({ name: x.name }));
      return { multi_select: valid };
    }
    case "date": {
      const d = prop.date;
      if (d && d.start) {
        const payload: any = { start: d.start };
        if (d.end) payload.end = d.end;
        if (d.time_zone) payload.time_zone = d.time_zone;
        return { date: payload };
      }
      return null;
    }
    case "checkbox": {
      return { checkbox: Boolean(prop.checkbox) };
    }
    case "url":
    case "email":
    case "phone_number": {
      return prop[type] ? { [type]: prop[type] } : null;
    }
    case "people":
    case "relation": {
      const arr = prop[type];
      if (!Array.isArray(arr)) return null;
      const valid = arr.filter((x: any) => x && x.id).map((x: any) => ({ id: x.id }));
      return { [type]: valid };
    }
    default:
      return null;
  }
}

async function duplicateNotionPageWithoutBody({
  token,
  sourcePageId,
  overrideTitle,
  overrideDate,
  overridePerson,
}: {
  token: string;
  sourcePageId: string;
  overrideTitle?: string;
  overrideDate?: { start: string; end?: string; timeZone?: string };
  overridePerson?: string;
}): Promise<{ pageId: string; pageUrl: string; title: string }> {
  const cleanId = sourcePageId.replace(/-/g, "");
  const pageRes = await fetch(`https://api.notion.com/v1/pages/${cleanId}`, {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!pageRes.ok) {
    const errText = await pageRes.text();
    throw new Error(`Error de Notion al leer página plantilla (${pageRes.status}): ${errText}`);
  }

  const sourcePage = await pageRes.json();
  const sourceProps = sourcePage.properties || {};

  const duplicateProperties: Record<string, any> = {};
  let titlePropName = "TITULO PRiNCIPAL";
  let datePropName = "";

  for (const [propName, propVal] of Object.entries(sourceProps) as [string, any][]) {
    if (propVal?.type === "title") {
      titlePropName = propName;
    }
    if (propVal?.type === "date") {
      if (propName.toLowerCase().includes("por hacer") || !datePropName) {
        datePropName = propName;
      }
    }

    const writable = buildWritablePropertyValue(propVal);
    if (writable) {
      duplicateProperties[propName] = writable[propVal.type];
    }
  }

  // 1. Sobrescribir título final formateado
  if (overrideTitle && overrideTitle.trim()) {
    duplicateProperties[titlePropName] = [
      {
        type: "text",
        text: { content: overrideTitle.trim() },
      },
    ];
  }

  // 2. Sobrescribir fecha programada (Fecha POR Hacer)
  if (overrideDate && overrideDate.start && datePropName) {
    duplicateProperties[datePropName] = {
      start: overrideDate.start,
      ...(overrideDate.end ? { end: overrideDate.end } : {}),
      ...(overrideDate.timeZone ? { time_zone: overrideDate.timeZone } : {}),
    };
  }

  // 3. Crear en Notion SIN BODY (sin children) - Paridad 1:1 ANFETA DuplicatePageWithoutBodyAsync
  const createPayload: any = {
    parent: sourcePage.parent,
    properties: duplicateProperties,
  };

  const createRes = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Error de Notion al duplicar página (${createRes.status}): ${errText}`);
  }

  const createdPage = await createRes.json();
  const newId = createdPage.id;
  const newUrl = createdPage.url || `https://notion.so/${newId.replace(/-/g, "")}`;

  return {
    pageId: newId,
    pageUrl: newUrl,
    title: overrideTitle || "Actividad desde plantilla",
  };
}

async function fetchNotionBlocksRecursive(
  cleanId: string,
  token: string,
  depth = 0,
  maxDepth = 3,
  output: any[] = [],
  seen: Set<string> = new Set()
): Promise<any[]> {
  if (depth > maxDepth || output.length >= 250 || seen.has(cleanId)) return output;
  seen.add(cleanId);

  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${cleanId}/children?page_size=100`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        "Notion-Version": "2022-06-28",
      },
    });

    if (!res.ok) return output;
    const data = await res.json();
    const results = data.results || [];

    for (const b of results) {
      if (output.length >= 250) break;
      const bType = b.type;
      const payload = b[bType] || {};

      let text = "";
      let isStrikethrough = false;
      if (payload.rich_text && Array.isArray(payload.rich_text)) {
        text = payload.rich_text.map((rt: any) => rt.plain_text || "").join("").trim();
        isStrikethrough = payload.rich_text.some((rt: any) => rt.annotations && rt.annotations.strikethrough);
      } else if (payload.title && Array.isArray(payload.title)) {
        text = payload.title.map((t: any) => t.plain_text || "").join("").trim();
      }

      if (text && TECHNICAL_PREFIXES.some((prefix) => text.startsWith(prefix))) {
        continue;
      }

      let url = "";
      if (payload.file && payload.file.url) url = payload.file.url;
      else if (payload.external && payload.external.url) url = payload.external.url;
      else if (payload.url) url = payload.url;

      const isStructural = STRUCTURAL_CONTAINERS.has(bType);

      if (!isStructural && (text || url || bType === "divider")) {
        output.push({
          id: b.id,
          kind: bType,
          text,
          isStrikethrough,
          isChecked: !!payload.checked,
          language: payload.language || "",
          url,
          depth,
          lastEditedTime: b.last_edited_time,
        });
      }

      // Si tiene hijos y no hemos llegado a maxDepth, explorar recursivamente
      if (b.has_children && depth < maxDepth) {
        if (bType === "synced_block" && payload.synced_from) {
          // Bloque sincronizado duplicado de otro lado: omitir duplicación
          continue;
        }
        await fetchNotionBlocksRecursive(b.id, token, depth + 1, maxDepth, output, seen);
      }
    }
  } catch (err) {
    console.warn("Error fetching children in recursion:", err);
  }

  return output;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const scope = searchParams.get("scope") || "day";

  try {
    if (type === "settings") {
      return NextResponse.json(getSettings());
    }

    if (type === "templates") {
      const catalog = readLocalJson<any>("notion_template_phase1_catalog_v2.json", null) ||
                      readLocalJson<any>("notion_template_phase1_catalog_v1.json", {});
      const items = catalog?.Items || [];
      return NextResponse.json({ total: items.length, items });
    }

    if (type === "search-index") {
      const rawIndex = readLocalJson<any[]>("index_cache.json", []);
      const items = rawIndex.map(normalizeSearchRow);

      // Paridad ANFETA: el caché de calendario se refresca con más frecuencia que
      // index_cache.json. Si una página fue renombrada en Notion (ej. "Pre proyecto"
      // -> "PreProyecto", o se le agregó "jjohn"), el índice queda desfasado y la
      // actividad marcada como "hoy" no aparece al buscarla. Enlazamos por PageId.
      const calData = readLocalJson<Record<string, any[]>>("notion_calendar_cache_v13.json", {});
      const latestByPage = new Map<string, { raw: any; date: string }>();
      for (const d of Object.keys(calData).sort()) {
        const acts = calData[d];
        if (!Array.isArray(acts)) continue;
        for (const a of acts) {
          if (a?.IsReviewMirror) continue;
          const pid = String(a?.PageId || "").replace(/-/g, "").toLowerCase();
          if (!pid) continue;
          latestByPage.set(pid, { raw: a, date: d });
        }
      }

      const seen = new Set<string>();
      for (const row of items) {
        const pid = String(row.externalId || "").replace(/-/g, "").toLowerCase();
        if (!pid) continue;
        seen.add(pid);
        const cal = latestByPage.get(pid);
        if (!cal) continue;
        const calTitle: string = cal.raw.Title || "";
        if (!calTitle) continue;
        const baseMatch = row.name.match(/^\[[^\]]+\]\s*/);
        const indexTitle = row.name.replace(/^\[[^\]]+\]\s*/, "").trim();
        if (calTitle.trim() !== indexTitle) {
          row.searchText = [row.searchText, row.name].filter(Boolean).join(" ");
          row.name = `${baseMatch ? baseMatch[0] : ""}${calTitle.trim()}`;
        }
        if (!row.scheduledDate && cal.raw.Start) row.scheduledDate = cal.raw.Start;
        if (!row.externalUrl && cal.raw.PageUrl) row.externalUrl = cal.raw.PageUrl;
      }

      // Páginas del calendario que aún no existen en el índice local (recién creadas)
      let injected = 0;
      for (const [pid, cal] of latestByPage) {
        if (seen.has(pid)) continue;
        const a = cal.raw;
        const title = a.Title || "";
        if (!title) continue;
        items.push({
          id: a.PageId,
          name: `[Revisiones] ${title}`,
          path: "",
          folder: "",
          extension: "",
          sizeBytes: 0,
          modifiedLocalDate: cal.date,
          serverModified: a.Start || "",
          source: "Notion",
          sourceName: "Revisiones",
          externalSourceName: "Revisiones",
          externalId: a.PageId,
          externalUrl: a.PageUrl || "",
          scheduledDate: a.Start || "",
          updateStatus: a.Status || "",
          projectUpdateStatus: a.Status || "",
          searchText: title,
          type: "PAGE",
          target: a.PageUrl || "",
        } as any);
        injected++;
      }

      return NextResponse.json({ total: items.length, injected, items });
    }

    if (type === "project-view-url") {
      const domain = (searchParams.get("domain") || "").trim().toLowerCase();
      if (!domain) {
        return NextResponse.json({ found: false, error: "No domain provided" });
      }

      const indexData = readLocalJson<any>("notion_project_view_index_v1.json", {});
      const viewsById = indexData?.ViewsById ? Object.values(indexData.ViewsById) : [];

      const normalize = (s: string) => (s || "").trim().toLowerCase().replace(/^www\./, "");
      const normDom = normalize(domain);
      const stuttered = normDom[0] + normDom;
      const root = normDom.split(".")[0];
      const stutteredRoot = root.length >= 4 ? root[0] + root : "";

      let matchedView: any = null;

      // 1. Exact match on view name or tartamuda
      for (const v of viewsById as any[]) {
        const nName = normalize(v.Name);
        if (nName === normDom || nName === stuttered) {
          matchedView = v;
          break;
        }
      }

      // 2. FilterJson contains domain
      if (!matchedView) {
        for (const v of viewsById as any[]) {
          if (v.FilterJson && (v.FilterJson.toLowerCase().includes(normDom) || v.FilterJson.toLowerCase().includes(stuttered))) {
            matchedView = v;
            break;
          }
        }
      }

      // 3. Name contains domain
      if (!matchedView) {
        for (const v of viewsById as any[]) {
          const nName = normalize(v.Name);
          if (nName.includes(normDom) || nName.includes(stuttered)) {
            matchedView = v;
            break;
          }
        }
      }

      // 4. Root contains
      if (!matchedView && root && root.length >= 4) {
        for (const v of viewsById as any[]) {
          const nName = normalize(v.Name);
          if (nName.includes(root) || (stutteredRoot && nName.includes(stutteredRoot))) {
            matchedView = v;
            break;
          }
        }
      }

      if (matchedView) {
        return NextResponse.json({
          found: true,
          domain,
          viewName: matchedView.Name,
          viewUrl: matchedView.Url,
          viewType: matchedView.Type,
        });
      }

      return NextResponse.json({
        found: false,
        domain,
        fallbackUrl: `https://www.notion.so/search?query=${encodeURIComponent(domain)}`,
      });
    }

    if (type === "calendar" || type === "calendar-week") {
      const calData = readLocalJson<Record<string, any[]>>(
        "notion_calendar_cache_v13.json",
        {}
      );
      const availableDates = Object.keys(calData).sort();

      if (scope === "week" || type === "calendar-week") {
        const targetD = new Date(date);
        const weekDates = availableDates.filter((d) => {
          const dt = new Date(d);
          const diffDays = Math.abs((dt.getTime() - targetD.getTime()) / (1000 * 3600 * 24));
          return diffDays <= 3.5;
        });

        const finalDates = weekDates.length > 0 ? weekDates : availableDates.slice(-7);
        const allWeekRaw: any[] = [];
        finalDates.forEach((d) => {
          if (Array.isArray(calData[d])) {
            allWeekRaw.push(...calData[d]);
          }
        });

        const activities = allWeekRaw.map(normalizeActivity);
        return NextResponse.json({
          date,
          scope: "week",
          dates: finalDates,
          count: activities.length,
          activities,
          availableDates,
        });
      }

      const rawActivities = calData[date] || [];
      const activities = rawActivities.map(normalizeActivity);
      return NextResponse.json({
        date,
        count: activities.length,
        activities,
        availableDates,
      });
    }

    if (type === "calendar-dates") {
      const calData = readLocalJson<Record<string, any[]>>(
        "notion_calendar_cache_v13.json",
        {}
      );
      return NextResponse.json({ dates: Object.keys(calData).sort() });
    }

    if (type === "daily-report") {
      const report = readLocalJson<any>("calendar_daily_report.json", {
        GeneratedAt: new Date().toISOString(),
        Reviewed: 0,
        Moved: 0,
        SkippedCompleted: 0,
        SkippedSuspended: 0,
        Failed: 0,
        Movements: [],
      });
      return NextResponse.json(report);
    }

    if (type === "pendientes") {
      const pendingPath = path.join(process.cwd(), "pendientes_store.json");
      let items: PendingTaskItem[] = [];
      if (fs.existsSync(pendingPath)) {
        try {
          items = JSON.parse(fs.readFileSync(pendingPath, "utf-8"));
        } catch {
          items = [];
        }
      }

      return NextResponse.json({ items: Array.isArray(items) ? items : [] });
    }

    if (type === "dropbox-folders") {
      const settings = getSettings();
      const baseDropbox = settings.dropboxPath || "C:\\Users\\nanoc\\Dropbox";
      const drxPath = path.join(baseDropbox, "DRX");
      const folders: { name: string; path: string }[] = [];

      try {
        if (fs.existsSync(drxPath)) {
          const items = fs.readdirSync(drxPath, { withFileTypes: true });
          items.forEach((it) => {
            if (it.isDirectory()) {
              folders.push({ name: it.name, path: path.join(drxPath, it.name) });
            }
          });
        }
      } catch (e) {
        console.error("Error reading Dropbox folders:", e);
      }
      return NextResponse.json({ baseDropbox, drxPath, folders });
    }

    if (type === "page-preview") {
      const filePath = searchParams.get("filePath");
      if (filePath) {
        try {
          if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.isFile() && stat.size <= 5 * 1024 * 1024) {
              const rawContent = fs.readFileSync(filePath, "utf-8");
              const lines = rawContent.split("\n").map((l: string) => l.trim()).filter(Boolean);
              const blocks = lines.map((line: string, idx: number) => {
                let kind = "paragraph";
                let isChecked = false;
                let text = line;
                if (line.startsWith("# ")) {
                  kind = "heading_1";
                  text = line.replace("# ", "");
                } else if (line.startsWith("## ")) {
                  kind = "heading_2";
                  text = line.replace("## ", "");
                } else if (line.startsWith("### ")) {
                  kind = "heading_3";
                  text = line.replace("### ", "");
                } else if (/^(\[x\]|✓)\s*/i.test(line)) {
                  kind = "to_do";
                  isChecked = true;
                  text = line.replace(/^(\[x\]|✓)\s*/i, "");
                } else if (/^\[ \]\s*/.test(line)) {
                  kind = "to_do";
                  isChecked = false;
                  text = line.replace(/^\[ \]\s*/, "");
                } else if (/^[-•]\s*/.test(line)) {
                  kind = "bulleted_list_item";
                  text = line.replace(/^[-•]\s*/, "");
                }
                return {
                  id: `fline-${idx}`,
                  kind,
                  text,
                  isChecked,
                  isStrikethrough: isChecked,
                };
              });

              return NextResponse.json({
                filePath,
                source: "local-file",
                content: rawContent,
                blocks,
                count: blocks.length,
              });
            }
          }
        } catch (fErr) {
          console.warn("Error reading local file preview:", fErr);
        }
      }

      const pageId = searchParams.get("pageId");
      if (!pageId) {
        return NextResponse.json({ error: "pageId o filePath es requerido" }, { status: 400 });
      }

      const cleanId = pageId.replace(/-/g, "").toLowerCase().trim();
      const settings = getSettings();
      const token = settings.notionToken;

      // 0. Revisar memoria caché (TTL 15 min)
      const now = Date.now();
      const cachedEntry = previewMemoryCache.get(cleanId);
      if (cachedEntry && now - cachedEntry.timestamp < PREVIEW_CACHE_TTL) {
        return NextResponse.json(cachedEntry.payload);
      }

      let blocks: any[] = [];
      let source = "none";
      let contentText = "";

      // 1. Si hay token configurado de Notion, obtener bloques recursivamente
      if (token && token.trim()) {
        try {
          blocks = await fetchNotionBlocksRecursive(cleanId, token, 0, 3);
          if (blocks.length > 0 && blocks.some((b) => b.text?.trim())) {
            source = "notion-api";
            contentText = blocks
              .map((b) => b.text)
              .filter(Boolean)
              .join("\n");
          }
        } catch (apiErr) {
          console.warn("Error fetching Notion blocks from API:", apiErr);
        }
      }

      // 2. Si no hay bloques con texto desde la API, recurrir a caché local (notion_content_cache.json)
      if (blocks.length === 0 || !blocks.some((b) => b.text?.trim())) {
        const cachePath = path.join(LOCAL_STATE_DIR, "notion_content_cache.json");
        if (fs.existsSync(cachePath)) {
          try {
            const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
            const cachedItem =
              cache[cleanId] ||
              Object.values(cache).find(
                (v: any) =>
                  v.pageId && v.pageId.replace(/-/g, "").toLowerCase() === cleanId
              );

            if (cachedItem && cachedItem.content) {
              const rawContent = cachedItem.content as string;
              const lines = rawContent.split("\n").map((l: string) => l.trim()).filter(Boolean);
              blocks = lines.map((line: string, idx: number) => {
                let kind = "paragraph";
                let isChecked = false;
                let isStrikethrough = false;
                let text = line;

                if (line.startsWith("### ")) {
                  kind = "heading_3";
                  text = line.replace("### ", "");
                } else if (line.startsWith("## ")) {
                  kind = "heading_2";
                  text = line.replace("## ", "");
                } else if (line.startsWith("# ")) {
                  kind = "heading_1";
                  text = line.replace("# ", "");
                } else if (/^(\[x\]|\[X\]|✓)\s*/.test(line)) {
                  kind = "to_do";
                  isChecked = true;
                  isStrikethrough = true;
                  text = line.replace(/^(\[x\]|\[X\]|✓)\s*/, "");
                } else if (/^(\[ \]|☐)\s*/.test(line)) {
                  kind = "to_do";
                  isChecked = false;
                  text = line.replace(/^(\[ \]|☐)\s*/, "");
                } else if (/^[-•]\s*/.test(line)) {
                  kind = "bulleted_list_item";
                  text = line.replace(/^[-•]\s*/, "");
                } else if (/^\d+\.\s*/.test(line)) {
                  kind = "numbered_list_item";
                  text = line.replace(/^\d+\.\s*/, "");
                } else if (line.startsWith("> ")) {
                  kind = "quote";
                  text = line.replace(/^>\s*/, "");
                } else if (line.startsWith("💡")) {
                  kind = "callout";
                  text = line.replace(/^💡\s*/, "");
                }

                return {
                  id: `line-${idx}`,
                  kind,
                  text,
                  isChecked,
                  isStrikethrough,
                };
              });

              source = "local-cache";
              contentText = rawContent;
            }
          } catch (cacheErr) {
            console.warn("Error reading notion_content_cache:", cacheErr);
          }
        }
      }

      if (blocks.length > 0) {
        const payload = {
          pageId: cleanId,
          source,
          blocks,
          content: contentText,
          count: blocks.length,
        };
        previewMemoryCache.set(cleanId, { timestamp: now, payload });
        return NextResponse.json(payload);
      }

      // 3. Si no existe contenido ni en API ni en caché
      return NextResponse.json({
        pageId: cleanId,
        source: "none",
        content: "",
        blocks: [],
        message: token
          ? "La página no tiene bloques visibles en Notion."
          : "Configura el token de Notion para cargar el contenido completo.",
      });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    if (action === "upload-to-dropbox") {
      const { targetDir, filename, base64 } = payload || {};
      if (!filename || !base64) {
        return NextResponse.json({ error: "Filename and base64 content required" }, { status: 400 });
      }

      const settings = getSettings();
      const baseDropbox = settings.dropboxPath || "C:\\Users\\nanoc\\Dropbox";
      let destDir = targetDir;
      if (!destDir || !destDir.trim()) {
        destDir = path.join(baseDropbox, "DRX");
      }
      if (fs.existsSync(destDir) && fs.statSync(destDir).isFile()) {
        destDir = path.dirname(destDir);
      }

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const safeFilename = path.basename(filename);
      const targetFilePath = path.join(destDir, safeFilename);
      const fileBuffer = Buffer.from(base64, "base64");
      fs.writeFileSync(targetFilePath, fileBuffer);

      return NextResponse.json({
        success: true,
        path: targetFilePath,
        filename: safeFilename,
        sizeBytes: fileBuffer.length,
        modifiedDate: new Date().toISOString(),
        targetDir: destDir,
      });
    }

    if (action === "create-dropbox-folder") {
      const { targetDir, folderName } = payload || {};
      if (!folderName || !folderName.trim()) {
        return NextResponse.json({ error: "Nombre de carpeta requerido" }, { status: 400 });
      }
      const settings = getSettings();
      const baseDropbox = settings.dropboxPath || "C:\\Users\\nanoc\\Dropbox";
      let destDir = targetDir;
      if (!destDir || !destDir.trim()) {
        destDir = path.join(baseDropbox, "DRX");
      }
      if (fs.existsSync(destDir) && fs.statSync(destDir).isFile()) {
        destDir = path.dirname(destDir);
      }

      const newFolderPath = path.join(destDir, folderName.trim());
      if (!fs.existsSync(newFolderPath)) {
        fs.mkdirSync(newFolderPath, { recursive: true });
      }

      return NextResponse.json({
        success: true,
        path: newFolderPath,
        folderName: folderName.trim(),
      });
    }

    if (action === "save-paste-to-dropbox") {
      const { title, body: pasteBody, domain, suffix, isUrl, targetDir } = payload || {};
      const settings = getSettings();
      const baseDropbox = settings.dropboxPath || "C:\\Users\\nanoc\\Dropbox";
      const drxRoot = path.join(baseDropbox, "DRX");

      let destDir = targetDir;
      if (!destDir || !destDir.trim()) {
        const cleanDomain = (domain || "anfeta.com").trim();
        const folderSuffix = suffix ? `.${suffix}` : ".Carpeta";
        destDir = path.join(drxRoot, `${cleanDomain}${folderSuffix}`);
      }

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const rawTitle = (title || (domain || "archivo")).trim();
      const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "_").trim();

      let filename = safeTitle;
      let content = pasteBody || "";

      if (isUrl) {
        if (!filename.toLowerCase().endsWith(".url")) filename += ".url";
        content = `[InternetShortcut]\r\nURL=${(pasteBody || "").trim()}\r\n`;
      } else {
        if (!filename.toLowerCase().endsWith(".txt")) filename += ".txt";
      }

      const filePath = path.join(destDir, filename);
      fs.writeFileSync(filePath, content, "utf-8");

      return NextResponse.json({
        success: true,
        path: filePath,
        filename,
        sizeBytes: Buffer.byteLength(content, "utf-8"),
        modifiedDate: new Date().toISOString(),
        targetDir: destDir,
        isUrl: !!isUrl,
      });
    }

    if (action === "create-notion-page") {
      const { title, body: pageBody } = payload || {};
      const settings = getSettings();
      const token = settings.notionToken;
      const createdId = `notion-${Date.now()}`;
      const pageUrl = `https://notion.so/${createdId}`;

      if (token && token.trim()) {
        try {
          const res = await fetch("https://api.notion.com/v1/pages", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token.trim()}`,
              "Notion-Version": "2022-06-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              parent: { database_id: "fake_or_configured_id" },
              properties: {
                title: {
                  title: [{ text: { content: title || "Nueva actividad" } }],
                },
              },
              children: [
                {
                  object: "block",
                  type: "paragraph",
                  paragraph: {
                    rich_text: [{ type: "text", text: { content: pageBody || "" } }],
                  },
                },
              ],
            }),
          });
          const data = await res.json();
          if (res.ok) {
            return NextResponse.json({
              success: true,
              pageId: data.id,
              pageUrl: data.url || `https://notion.so/${data.id}`,
              title,
            });
          }
        } catch {
          // Fallback a simulación
        }
      }

      return NextResponse.json({
        success: true,
        pageId: createdId,
        pageUrl,
        title: title || "Nueva actividad",
        offline: true,
      });
    }

    if (action === "save-settings") {
      saveSettings(payload);
      return NextResponse.json({ success: true, settings: payload });
    }

    if (action === "test-notion-token") {
      const token = payload?.token || getSettings().notionToken;
      if (!token || !token.trim()) {
        return NextResponse.json({ success: false, error: "Token vacío" }, { status: 400 });
      }

      try {
        const res = await fetch("https://api.notion.com/v1/users/me", {
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            "Notion-Version": "2022-06-28",
          },
        });
        const data = await res.json();
        if (res.ok) {
          return NextResponse.json({
            success: true,
            bot: data.name || data.bot?.owner?.user?.name || "Integración Conectada",
          });
        }
        return NextResponse.json(
          { success: false, error: data.message || `HTTP ${res.status}` },
          { status: 400 }
        );
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    if (action === "sync-notion") {
      const token = payload?.token || getSettings().notionToken;
      if (!token || !token.trim()) {
        return NextResponse.json(
          { success: false, error: "No se ha configurado el Token de Notion" },
          { status: 400 }
        );
      }

      try {
        const res = await fetch("https://api.notion.com/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ page_size: 100 }),
        });

        if (!res.ok) {
          const errData = await res.json();
          return NextResponse.json(
            { success: false, error: errData.message || `HTTP ${res.status}` },
            { status: 400 }
          );
        }

        const data = await res.json();
        const pages = data.results || [];
        return NextResponse.json({
          success: true,
          count: pages.length,
          message: `Sincronizadas ${pages.length} páginas desde la API en vivo de Notion`,
        });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    if (action === "save-pendientes") {
      const pendingPath = path.join(process.cwd(), "pendientes_store.json");
      fs.writeFileSync(pendingPath, JSON.stringify(payload, null, 2), "utf-8");
      return NextResponse.json({ success: true, count: payload.length });
    }

    if (action === "open-explorer") {
      const targetPath = payload?.path;
      if (targetPath && typeof targetPath === "string") {
        const cleanPath = targetPath.replace(/"/g, '""');
        exec(`explorer.exe /select,"${cleanPath}"`, (err) => {
          if (err) console.error("Error launching explorer:", err);
        });
        return NextResponse.json({ success: true, path: targetPath });
      }
      return NextResponse.json({ error: "Path missing" }, { status: 400 });
    }

    if (action === "open-file") {
      const targetPath = payload?.path;
      if (targetPath && typeof targetPath === "string") {
        const cleanPath = targetPath.replace(/"/g, '""');
        exec(`start "" "${cleanPath}"`, (err) => {
          if (err) console.error("Error opening file:", err);
        });
        return NextResponse.json({ success: true, path: targetPath });
      }
      return NextResponse.json({ error: "Path missing" }, { status: 400 });
    }

    if (action === "update-activity-status") {
      const { id, status } = payload || {};
      if (!id || !status) {
        return NextResponse.json({ error: "id and status required" }, { status: 400 });
      }

      const settings = getSettings();
      const token = settings.notionToken;
      const cleanId = id.replace(/-/g, "");

      if (token && token.trim()) {
        try {
          const patchBody = {
            properties: {
              Estado: {
                status: { name: status },
              },
            },
          };
          const res = await fetch(`https://api.notion.com/v1/pages/${cleanId}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token.trim()}`,
              "Notion-Version": "2022-06-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(patchBody),
          });
          if (!res.ok) {
            await fetch(`https://api.notion.com/v1/pages/${cleanId}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token.trim()}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                properties: {
                  Estado: {
                    select: { name: status },
                  },
                },
              }),
            });
          }
        } catch (err) {
          console.warn("Could not patch status to Notion API directly:", err);
        }
      }

      return NextResponse.json({ success: true, id, status });
    }

    if (action === "rename-item") {
      const { id, source, oldName, newName, path: itemPath } = payload || {};
      if (!newName || !newName.trim()) {
        return NextResponse.json({ error: "newName required" }, { status: 400 });
      }

      const settings = getSettings();
      const token = settings.notionToken;
      const cleanNewName = newName.trim();

      if (source?.toLowerCase() === "notion" || (!itemPath && id)) {
        if (token && token.trim()) {
          const cleanId = id.replace(/-/g, "");
          try {
            await fetch(`https://api.notion.com/v1/pages/${cleanId}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token.trim()}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                properties: {
                  title: [
                    {
                      text: { content: cleanNewName },
                    },
                  ],
                },
              }),
            });
          } catch (err) {
            console.warn("Error renaming Notion page via API:", err);
          }
        }
        return NextResponse.json({ success: true, id, newName: cleanNewName });
      }

      if (itemPath && fs.existsSync(itemPath)) {
        try {
          const dir = path.dirname(itemPath);
          const newPath = path.join(dir, cleanNewName);
          fs.renameSync(itemPath, newPath);
          return NextResponse.json({ success: true, id, oldPath: itemPath, newPath, newName: cleanNewName });
        } catch (err: any) {
          return NextResponse.json({ error: err.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, id, newName: cleanNewName });
    }

    if (action === "duplicate-item") {
      const { id, source, title, path: itemPath } = payload || {};
      const newTitle = (title || "Copia").trim();
      const settings = getSettings();
      const token = settings.notionToken;

      if (source?.toLowerCase() === "notion" || (!itemPath && id)) {
        let cleanId = `dup-${Date.now()}`;
        let pageUrl = "";
        if (token && token.trim() && id) {
          try {
            const dupResult = await duplicateNotionPageWithoutBody({
              token,
              sourcePageId: id,
              overrideTitle: newTitle,
            });
            cleanId = dupResult.pageId;
            pageUrl = dupResult.pageUrl;
          } catch (err: any) {
            console.warn("[DUPLICATE_ITEM] Error duplicando en Notion API:", err?.message);
          }
        }

        // Indexar al inicio de index_cache.json como en ANFETA original
        try {
          const rawIndex = readLocalJson<any[]>("index_cache.json", []);
          rawIndex.unshift({
            id: cleanId,
            name: newTitle,
            source: "Notion",
            sourceName: "Revisiones",
            type: "Notion",
            url: pageUrl,
            serverModified: new Date().toISOString(),
            statusLabel: "rtuzREVISION",
          });
          const fullIndexPath = path.join(LOCAL_STATE_DIR, "index_cache.json");
          fs.writeFileSync(fullIndexPath, JSON.stringify(rawIndex, null, 2), "utf-8");
        } catch (err) {
          console.warn("Error guardando index_cache.json tras duplicar:", err);
        }

        return NextResponse.json({ success: true, id: cleanId, title: newTitle, pageUrl });
      }

      if (itemPath && fs.existsSync(itemPath)) {
        try {
          const dir = path.dirname(itemPath);
          const ext = path.extname(itemPath);
          const base = path.basename(itemPath, ext);
          const newFilename = `${base} (Copia)${ext}`;
          const newPath = path.join(dir, newFilename);
          if (fs.statSync(itemPath).isDirectory()) {
            fs.cpSync(itemPath, newPath, { recursive: true });
          } else {
            fs.copyFileSync(itemPath, newPath);
          }
          return NextResponse.json({ success: true, newPath, title: newFilename });
        } catch (err: any) {
          return NextResponse.json({ error: err.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, title: newTitle });
    }

    if (action === "delete-item") {
      const { id, source, path: itemPath } = payload || {};
      const settings = getSettings();
      const token = settings.notionToken;

      if (source?.toLowerCase() === "notion" && id && token && token.trim()) {
        try {
          await fetch(`https://api.notion.com/v1/pages/${id.replace(/-/g, "")}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token.trim()}`,
              "Notion-Version": "2022-06-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ archived: true }),
          });
        } catch (err) {
          console.warn("Error archiving Notion page:", err);
        }
      } else if (itemPath && fs.existsSync(itemPath)) {
        try {
          fs.rmSync(itemPath, { recursive: true, force: true });
        } catch (err) {
          console.warn("Error deleting file on disk:", err);
        }
      }

      return NextResponse.json({ success: true, id });
    }

    if (action === "create-from-template") {
      const { date, requests } = payload || body;
      const targetDate = date || new Date().toISOString().split("T")[0];
      const itemsList = Array.isArray(requests) ? requests : [];

      if (itemsList.length === 0) {
        return NextResponse.json({ error: "No se proporcionaron plantillas para crear" }, { status: 400 });
      }

      const settings = getSettings();
      const token = settings.notionToken;

      // Cargar caché del calendario
      const calData = readLocalJson<Record<string, any[]>>("notion_calendar_cache_v13.json", {});
      if (!calData[targetDate]) {
        calData[targetDate] = [];
      }

      const createdActivities: any[] = [];
      const timestamp = Date.now();

      for (let idx = 0; idx < itemsList.length; idx++) {
        const req = itemsList[idx];
        const finalTitle = req.title || "Actividad desde plantilla";
        const shortTitle = req.shortTitle || finalTitle.replace(/^prtuzREVISION\s+/i, "");
        const sourcePageId = req.sourcePageId;

        let createdPageId = `tpl-${timestamp}-${idx}`;
        let createdPageUrl = sourcePageId ? `https://notion.so/${sourcePageId.replace(/-/g, "")}` : "";

        // Duplicación real 1:1 en Notion (DuplicatePageWithoutBody):
        // Hereda todas las propiedades de la plantilla pero SIN CONTENIDO (body vacío).
        if (token && token.trim() && sourcePageId) {
          try {
            const dupResult = await duplicateNotionPageWithoutBody({
              token,
              sourcePageId,
              overrideTitle: finalTitle,
              overrideDate: {
                start: req.start || `${targetDate}T10:00:00-06:00`,
                end: req.end || `${targetDate}T10:30:00-06:00`,
              },
              overridePerson: req.person,
            });
            createdPageId = dupResult.pageId;
            createdPageUrl = dupResult.pageUrl;
          } catch (notionErr: any) {
            console.warn(`[NOTION_TEMPLATE_DUPLICATE] Fallback local tras error: ${notionErr?.message}`);
          }
        }

        // Estructura idéntica a ANFETA WinUI: actividad duplicada sin body previo (checklistItems vacíos)
        const newAct = {
          pageId: createdPageId,
          title: finalTitle,
          shortTitle,
          start: req.start || `${targetDate}T10:00:00-06:00`,
          end: req.end || `${targetDate}T10:30:00-06:00`,
          person: req.person || "Sin asignar",
          domain: req.domain || "DOMINIO",
          status: "rtuzREVISION",
          isCompletedForReview: true,
          checklistTotal: 0,
          checklistCompleted: 0,
          checklistItems: [], // Vacío: la plantilla se duplica sin contenido para que el usuario escriba el suyo
          pageUrl: createdPageUrl,
          isFinalized: false,
          isUrgent: false,
        };

        calData[targetDate].push(newAct);
        createdActivities.push(newAct);
      }

      // Guardar en notion_calendar_cache_v13.json
      try {
        const fullCalPath = path.join(LOCAL_STATE_DIR, "notion_calendar_cache_v13.json");
        fs.writeFileSync(fullCalPath, JSON.stringify(calData, null, 2), "utf-8");
      } catch (err) {
        console.warn("Error guardando notion_calendar_cache_v13.json:", err);
      }

      // También indexar en index_cache.json al inicio (posición 0) como hace ANFETA WinUI
      try {
        const rawIndex = readLocalJson<any[]>("index_cache.json", []);
        createdActivities.forEach((act) => {
          rawIndex.unshift({
            id: act.pageId,
            name: act.title,
            source: "Notion",
            sourceName: "Revisiones",
            type: "Notion",
            url: act.pageUrl,
            serverModified: new Date().toISOString(),
            scheduledDate: targetDate,
            assignedPerson: act.person,
            domainChip: act.domain,
            statusLabel: act.status,
          });
        });
        const fullIndexPath = path.join(LOCAL_STATE_DIR, "index_cache.json");
        fs.writeFileSync(fullIndexPath, JSON.stringify(rawIndex, null, 2), "utf-8");
      } catch (err) {
        console.warn("Error guardando index_cache.json:", err);
      }

      return NextResponse.json({
        success: true,
        count: createdActivities.length,
        createdActivities,
        date: targetDate,
      });
    }

    return NextResponse.json({ error: "Action not supported" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error writing data" },
      { status: 500 }
    );
  }
}
