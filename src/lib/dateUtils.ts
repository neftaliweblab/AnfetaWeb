/**
 * dateUtils.ts
 * Utilidades centralizadas de formateo de fechas inteligentes en español para ANFETA.
 * Soporta formateo relativo ("Hoy a las 4:30 PM", "Ayer a las 3:15 PM", "Mañana a las 9:00 AM"),
 * rangos horarios ("Hoy · 10:00 AM - 11:30 AM"), fechas calendario y encabezados WinUI.
 */

export interface ParsedDateResult {
  date: Date;
  hasTime: boolean;
}

/**
 * Parsea de forma segura cualquier string o Date evitando los desfases de zona horaria de JS.
 */
export function parseDateSafe(input: string | Date | undefined | null): ParsedDateResult | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return { date: input, hasTime: true };
  }

  const str = String(input).trim();
  if (!str || str === "—" || str === "-") return null;

  // Formato ISO solo fecha: YYYY-MM-DD o YYYY/MM/DD
  const isoDateOnly = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoDateOnly) {
    const y = parseInt(isoDateOnly[1], 10);
    const m = parseInt(isoDateOnly[2], 10) - 1;
    const d = parseInt(isoDateOnly[3], 10);
    // Usar mediodía local para evitar desfases de medianoche o DST
    return { date: new Date(y, m, d, 12, 0, 0), hasTime: false };
  }

  // Formato latino solo fecha: DD/MM/YYYY o DD-MM-YYYY
  const latinDateOnly = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (latinDateOnly) {
    const d = parseInt(latinDateOnly[1], 10);
    const m = parseInt(latinDateOnly[2], 10) - 1;
    const y = parseInt(latinDateOnly[3], 10);
    return { date: new Date(y, m, d, 12, 0, 0), hasTime: false };
  }

  // Fecha estándar con hora ISO o formato local
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;

  // Determinar si incluye hora explícita
  const hasTime =
    str.includes("T") ||
    str.includes(":") ||
    (parsed.getHours() !== 0 || parsed.getMinutes() !== 0);

  return { date: parsed, hasTime };
}

/**
 * Comprueba si dos fechas corresponden al mismo día del año en hora local.
 */
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Obtiene el nombre relativo del día ("Hoy", "Ayer", "Mañana") o null.
 */
export function getRelativeDayName(date: Date, now: Date = new Date()): "Hoy" | "Ayer" | "Mañana" | null {
  if (isSameDay(date, now)) return "Hoy";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Ayer";

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(date, tomorrow)) return "Mañana";

  return null;
}

/**
 * Formatea una hora en formato 12 horas AM/PM (ej. "4:30 PM", "10:15 AM").
 */
export function formatTime12h(date: Date): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Formatea una fecha única con lógica relativa inteligente en español.
 * - Hoy: "Hoy a las 4:30 PM" (o "Hoy" si no tiene hora)
 * - Ayer: "Ayer a las 3:15 PM" (o "Ayer" si no tiene hora)
 * - Mañana: "Mañana a las 9:00 AM" (o "Mañana" si no tiene hora)
 * - Mismo año: "04/10 a las 4:30 PM"
 * - Otro año: "04/10/2025 a las 4:30 PM"
 */
export function formatSmartSingleDate(parsed: ParsedDateResult, now: Date = new Date()): string {
  const { date, hasTime } = parsed;
  const rel = getRelativeDayName(date, now);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const isThisYear = year === now.getFullYear();

  if (hasTime) {
    const timeStr = formatTime12h(date);
    if (rel) {
      return `${rel} a las ${timeStr}`;
    }
    const datePrefix = isThisYear ? `${day}/${month}` : `${day}/${month}/${year}`;
    return `${datePrefix} a las ${timeStr}`;
  }

  // Sin hora
  if (rel) {
    return rel;
  }
  return `${day}/${month}/${year}`;
}

/**
 * Formateador principal inteligente para cualquier fecha o rango de fechas de Notion/Dropbox.
 * Soporta entradas simples ("2026-10-04T16:30:00Z") o rangos ("2026-10-04T10:00:00 - 2026-10-04T11:30:00").
 */
export function formatSmartDate(rawDate?: string | Date | null, now: Date = new Date()): string {
  if (!rawDate) return "—";

  const rawStr = String(rawDate).trim();
  if (!rawStr || rawStr === "—" || rawStr === "-") return "—";

  // Comprobar si es un rango delimitado por " - " o " a "
  const rangeDelimiter = rawStr.includes(" - ") ? " - " : rawStr.includes(" a ") ? " a " : null;

  if (rangeDelimiter) {
    const parts = rawStr.split(rangeDelimiter).map((p) => p.trim());
    if (parts.length === 2) {
      const p1 = parseDateSafe(parts[0]);
      const p2 = parseDateSafe(parts[1]);

      if (p1 && p2) {
        // ¿Mismo día?
        if (isSameDay(p1.date, p2.date)) {
          const rel = getRelativeDayName(p1.date, now);
          const day = String(p1.date.getDate()).padStart(2, "0");
          const month = String(p1.date.getMonth() + 1).padStart(2, "0");
          const year = p1.date.getFullYear();
          const isThisYear = year === now.getFullYear();
          const prefix = rel || (isThisYear ? `${day}/${month}` : `${day}/${month}/${year}`);

          if (p1.hasTime && p2.hasTime) {
            return `${prefix} · ${formatTime12h(p1.date)} - ${formatTime12h(p2.date)}`;
          } else if (p1.hasTime) {
            return `${prefix} a las ${formatTime12h(p1.date)}`;
          } else {
            return prefix;
          }
        } else {
          // Días diferentes
          return `${formatSmartSingleDate(p1, now)} - ${formatSmartSingleDate(p2, now)}`;
        }
      }
    }
  }

  const single = parseDateSafe(rawStr);
  if (!single) return rawStr;

  return formatSmartSingleDate(single, now);
}

/**
 * Formatea un encabezado de fecha largo en español como el calendario WinUI de ANFETA:
 * Ej: "Domingo, 4 de octubre de 2026"
 */
export function formatLongCalendarDate(dateInput: string | Date | null, now: Date = new Date()): {
  fullText: string;
  relativeBadge: string | null;
} {
  const parsed = parseDateSafe(dateInput);
  if (!parsed) {
    return { fullText: String(dateInput || ""), relativeBadge: null };
  }

  const { date } = parsed;
  const rel = getRelativeDayName(date, now);

  try {
    const rawLong = date.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    // Capitalizar la primera letra (ej. "domingo" -> "Domingo")
    const capitalized = rawLong.charAt(0).toUpperCase() + rawLong.slice(1);
    return {
      fullText: capitalized,
      relativeBadge: rel,
    };
  } catch {
    return {
      fullText: `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`,
      relativeBadge: rel,
    };
  }
}

/**
 * Desplaza una fecha en formato YYYY-MM-DD por una cantidad de días de forma segura ante zonas horarias.
 */
export function shiftDayString(dateStr: string, offset: number): string {
  if (!dateStr) return getTodayDateString();
  const parts = dateStr.split(/[-/]/).map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return getTodayDateString();
  }
  const y = parts[0];
  const m = parts[1] - 1;
  const d = parts[2];
  const dt = new Date(y, m, d, 12, 0, 0);
  dt.setDate(dt.getDate() + offset);
  const nextY = dt.getFullYear();
  const nextM = String(dt.getMonth() + 1).padStart(2, "0");
  const nextD = String(dt.getDate()).padStart(2, "0");
  return `${nextY}-${nextM}-${nextD}`;
}

/**
 * Obtiene la fecha actual en formato local YYYY-MM-DD sin desfase UTC.
 */
export function getTodayDateString(): string {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

