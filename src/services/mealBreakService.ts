import { normalizePerson } from "./identityNormalizer";

export interface MealBreakConfig {
  enabled: boolean;
  startHour: number; // e.g. 13 for 1:00 PM
  startMinute: number; // e.g. 0
  endHour: number; // e.g. 14 for 2:00 PM
  endMinute: number; // e.g. 0
  label: string;
}

export const DEFAULT_MEAL_BREAK: MealBreakConfig = {
  enabled: true,
  startHour: 13,
  startMinute: 0,
  endHour: 14,
  endMinute: 0,
  label: "Horario Especial · Comida",
};

const MEAL_BREAK_EVENT = "anfeta_meal_break_updated";

export function getMealBreakStorageKey(user: string): string {
  return `anfeta_meal_break_v1:${normalizePerson(user)}`;
}

/**
 * Obtiene la configuración de hora de comida para el usuario actual.
 * Por defecto solo está activo para "Neftali" según la solicitud.
 */
export function getMealBreakConfig(currentUser: string): MealBreakConfig {
  const normalized = normalizePerson(currentUser);
  const isNeftali = normalized === "Neftali";

  if (typeof window === "undefined") {
    return isNeftali ? DEFAULT_MEAL_BREAK : { ...DEFAULT_MEAL_BREAK, enabled: false };
  }

  try {
    const key = getMealBreakStorageKey(currentUser);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        return {
          enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : isNeftali,
          startHour: typeof parsed.startHour === "number" ? parsed.startHour : 13,
          startMinute: typeof parsed.startMinute === "number" ? parsed.startMinute : 0,
          endHour: typeof parsed.endHour === "number" ? parsed.endHour : 14,
          endMinute: typeof parsed.endMinute === "number" ? parsed.endMinute : 0,
          label: typeof parsed.label === "string" && parsed.label.trim() ? parsed.label : "Horario Especial · Comida",
        };
      }
    }
  } catch {}

  // Si no hay configuración guardada: activo por defecto para Neftali, inactivo para otros usuarios
  return isNeftali ? DEFAULT_MEAL_BREAK : { ...DEFAULT_MEAL_BREAK, enabled: false };
}

/**
 * Guarda la configuración de comida y notifica a todos los componentes escuchando.
 */
export function saveMealBreakConfig(currentUser: string, config: MealBreakConfig): void {
  if (typeof window === "undefined") return;
  try {
    const key = getMealBreakStorageKey(currentUser);
    localStorage.setItem(key, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(MEAL_BREAK_EVENT, { detail: { user: normalizePerson(currentUser), config } }));
    // Sincronizar con el servidor para que Bitácora FTF (John y Neftali) descuente este bloque de comida en la cobertura
    if (typeof fetch === "function") {
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-meal-break", payload: { user: currentUser, config } }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error("Error guardando horario de comida:", e);
  }
}

/**
 * Formatea la hora en formato 12h (ej. 1:00 PM)
 */
export function formatHour12(hour: number, minute: number = 0): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const minStr = minute > 0 ? `:${minute.toString().padStart(2, "0")}` : ":00";
  return `${h12}${minStr} ${ampm}`;
}

export { MEAL_BREAK_EVENT };
