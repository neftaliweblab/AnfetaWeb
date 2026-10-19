export interface ResponseScanItem {
  id: string;
  name: string;
  url?: string;
  serverModified?: string;
  statusName: string;
  isPending: boolean;
  isFinalized: boolean;
  isExpired: boolean;
  ageHours: number;
  dateFormatted: string;
  recipient?: string;
  sender?: string;
}

export function isExpiredResponsePage(row: any, nowMs = Date.now()): boolean {
  const name = String(row?.name || row?.title || row?.Name || "").trim();
  if (!name.includes("[RESPUESTA]")) return false;

  // Verificar que NO sea una actividad aún En revisión o pendiente
  const statusStr = String(row?.updateStatus || row?.statusLabel || row?.status || "").toLowerCase();
  const fullText = (name + " " + statusStr).toLowerCase();

  if (
    fullText.includes("actividad lista para revisión") ||
    fullText.includes("actividad lista para revision") ||
    fullText.includes("correcciones solicitadas") ||
    fullText.includes("en revisión") ||
    fullText.includes("en revision") ||
    fullText.includes("prtuzrevision") ||
    fullText.includes("aprtuzrevision") ||
    fullText.includes("sprtuzrevision") ||
    fullText.includes("pendiente") ||
    fullText.includes("por hacer")
  ) {
    return false;
  }

  // Verificar que esté FINALIZADA (Revisión aprobada, Terminada, etc.)
  const isFinalized =
    fullText.includes("revisión aprobada") ||
    fullText.includes("revision aprobada") ||
    fullText.includes("[terminado]") ||
    fullText.includes("terminada") ||
    fullText.includes("terminado") ||
    fullText.includes("cobrado terminado") ||
    fullText.includes("zrevision");

  if (!isFinalized) return false;

  // Extraer timestamp del título (ej. "2026-10-16 17:23 ...")
  let dateMs: number | null = null;
  const match = name.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})[ T](\d{2}[:\-]\d{2})/);
  if (match) {
    const isoString = `${match[1]}T${match[2].replace("-", ":")}:00-06:00`;
    const parsed = Date.parse(isoString);
    if (Number.isFinite(parsed)) dateMs = parsed;
  }
  if (!dateMs) {
    const rawDate = row?.serverModified || row?.last_edited_time || row?.lastEdited || row?.scheduledDate;
    if (rawDate) {
      const parsed = Date.parse(rawDate);
      if (Number.isFinite(parsed)) dateMs = parsed;
    }
  }

  if (!dateMs) return false;

  // Condición: haber pasado más de 24 horas (86,400,000 ms)
  const ageMs = nowMs - dateMs;
  return ageMs > 24 * 60 * 60 * 1000;
}

export function parseResponsePageRow(
  id: string,
  title: string,
  rawDate: string | undefined,
  statusPropName: string | undefined,
  pageUrl?: string,
  nowMs = Date.now()
): ResponseScanItem | null {
  if (!title.includes("[RESPUESTA]")) return null;

  const statusStr = String(statusPropName || "").toLowerCase();
  const fullLower = (title + " " + statusStr).toLowerCase();

  const isPending =
    fullLower.includes("actividad lista para revisión") ||
    fullLower.includes("actividad lista para revision") ||
    fullLower.includes("correcciones solicitadas") ||
    fullLower.includes("en revisión") ||
    fullLower.includes("en revision") ||
    fullLower.includes("prtuzrevision") ||
    fullLower.includes("aprtuzrevision") ||
    fullLower.includes("sprtuzrevision") ||
    fullLower.includes("pendiente") ||
    fullLower.includes("por hacer");

  const isFinalized =
    fullLower.includes("revisión aprobada") ||
    fullLower.includes("revision aprobada") ||
    fullLower.includes("[terminado]") ||
    fullLower.includes("terminada") ||
    fullLower.includes("terminado") ||
    fullLower.includes("cobrado terminado") ||
    fullLower.includes("zrevision");

  let dateMs: number | null = null;
  let dateFormatted = "";
  const match = title.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})[ T](\d{2}[:\-]\d{2})/);
  if (match) {
    const isoString = `${match[1]}T${match[2].replace("-", ":")}:00-06:00`;
    const parsed = Date.parse(isoString);
    if (Number.isFinite(parsed)) {
      dateMs = parsed;
      dateFormatted = `${match[1]} ${match[2]}`;
    }
  }
  if (!dateMs && rawDate) {
    const parsed = Date.parse(rawDate);
    if (Number.isFinite(parsed)) {
      dateMs = parsed;
      dateFormatted = new Date(parsed).toISOString().slice(0, 16).replace("T", " ");
    }
  }

  const ageMs = dateMs ? Math.max(0, nowMs - dateMs) : 0;
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
  const isExpired = !isPending && isFinalized && ageHours >= 24;

  const userMatch = title.match(/(?:^|\s)([a-z0-9_]{3,8})\s+(?:de:|dex\s*|de\s+)([a-z0-9_]{3,15})/i);
  const recipient = userMatch ? userMatch[1] : undefined;
  const sender = userMatch ? userMatch[2] : undefined;

  const cleanId = id.replace(/-/g, "").toLowerCase();
  const url = pageUrl || `https://notion.so/${cleanId}`;

  return {
    id,
    name: title,
    url,
    serverModified: rawDate,
    statusName: statusPropName || (isFinalized ? "Revisión aprobada" : isPending ? "En revisión" : "Finalizada"),
    isPending,
    isFinalized,
    isExpired,
    ageHours,
    dateFormatted: dateFormatted || "Sin fecha",
    recipient,
    sender,
  };
}
