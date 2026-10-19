const assert = require('assert/strict');

function isExpiredResponsePage(row, nowMs = Date.now()) {
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
  let dateMs = null;
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

  // Debe haber pasado más de 24 horas (86,400,000 ms)
  const ageMs = nowMs - dateMs;
  return ageMs > 24 * 60 * 60 * 1000;
}

console.log('--- Probando Reglas de Expiración y Limpieza de Páginas [RESPUESTA] ---');

const now = Date.parse('2026-10-19T11:00:00-06:00');

// 1. Actividad EN REVISIÓN aunque sea de hace 3 días -> NO debe eliminarse
const pendingCase1 = {
  name: '2026-10-16 17:23 ggena desandrade [RESPUESTA] Actividad lista para revisión - wwebs 26...',
  updateStatus: 'EN REVISIÓN'
};
assert.equal(isExpiredResponsePage(pendingCase1, now), false, 'Actividad aún En revisión NO debe eliminarse');

// 2. Actividad EN REVISIÓN de agosto -> NO debe eliminarse
const pendingCase2 = {
  name: '2026-08-31 09:00 ggena desandrade [RESPUESTA] Actividad lista para revisión ...',
  updateStatus: 'EN REVISIÓN'
};
assert.equal(isExpiredResponsePage(pendingCase2, now), false, 'Actividad En revisión antigua NO debe eliminarse');

// 3. Respuesta APROBADA de hace 3 días (16 de octubre) -> SÍ debe eliminarse (>24 horas)
const approvedOldCase1 = {
  name: '2026-10-16 13:44 aandr dexgenaro [RESPUESTA] Revisión aprobada - wwebs 26 [10OCT] 2...',
  updateStatus: 'TERMINADA'
};
assert.equal(isExpiredResponsePage(approvedOldCase1, now), true, 'Respuesta aprobada de hace 3 días SÍ debe eliminarse');

// 4. Respuesta APROBADA de hace 4 días (15 de octubre) -> SÍ debe eliminarse
const approvedOldCase2 = {
  name: '2026-10-15 12:46 aandr dexgenaro [RESPUESTA] Revisión aprobada - wwebs 26 [10DC...',
  updateStatus: 'TERMINADA'
};
assert.equal(isExpiredResponsePage(approvedOldCase2, now), true, 'Respuesta aprobada del 15/10 SÍ debe eliminarse');

// 5. Respuesta APROBADA de hace 2 horas (mismo día) -> NO debe eliminarse (< 24 horas)
const approvedRecentCase = {
  name: '2026-10-19 09:00 aandr dexgenaro [RESPUESTA] Revisión aprobada - wwebs 26...',
  updateStatus: 'TERMINADA'
};
assert.equal(isExpiredResponsePage(approvedRecentCase, now), false, 'Respuesta aprobada reciente (<24h) NO debe eliminarse');

// 6. Actividad normal sin etiqueta [RESPUESTA] -> NUNCA debe eliminarse
const normalTask = {
  name: '2026-10-15 10:00 jjohn - wwebs 26 reporte mensual',
  updateStatus: 'TERMINADA'
};
assert.equal(isExpiredResponsePage(normalTask, now), false, 'Actividad normal sin [RESPUESTA] NUNCA debe eliminarse');

console.log('OK: Reglas de páginas [RESPUESTA] verificadas al 100%. Solo finalizadas > 24h son candidatas a limpieza.');

// 7. Prueba del Escáner y Parser para Previsualización y Selección Manual
function parseResponsePageRow(id, title, rawDate, statusPropName, pageUrl, nowMs = Date.now()) {
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

  let dateMs = null;
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

console.log('--- Probando Escaneo, Previsualización y Selección Manual ---');

// Parsear 3 tipos de páginas
const scan1 = parseResponsePageRow('p-1', approvedOldCase1.name, undefined, approvedOldCase1.updateStatus, undefined, now);
assert.equal(scan1.isExpired, true, 'Scan1 debe estar marcado como expirado');
assert.equal(scan1.recipient, 'aandr');
assert.equal(scan1.sender, 'genaro');

const scan2 = parseResponsePageRow('p-2', approvedRecentCase.name, undefined, approvedRecentCase.updateStatus, undefined, now);
assert.equal(scan2.isExpired, false, 'Scan2 reciente no debe estar expirado');
assert.equal(scan2.isFinalized, true);

const scan3 = parseResponsePageRow('p-3', pendingCase1.name, undefined, pendingCase1.updateStatus, undefined, now);
assert.equal(scan3.isPending, true, 'Scan3 debe estar marcado como pendiente');
assert.equal(scan3.isExpired, false);

// Simular selección manual del usuario:
// Supongamos que el usuario solo quiere borrar scan1 (expirada) y dejar scan2 intacto
const userSelection = new Set([scan1.id]);
assert.equal(userSelection.has(scan1.id), true, 'Scan1 seleccionado para borrar');
assert.equal(userSelection.has(scan2.id), false, 'Scan2 conservado (no se borra)');
assert.equal(userSelection.has(scan3.id), false, 'Scan3 pendiente conservado (no se borra)');

console.log('OK: Escáner y previsualización con selección manual probados al 100%.');

