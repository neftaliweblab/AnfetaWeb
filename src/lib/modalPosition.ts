"use client";

export type ModalPositionMode = "top_high" | "top" | "custom" | "center";

export interface ModalPositionConfig {
  mode: ModalPositionMode;
  topOffset: number; // Offset en píxeles desde el borde superior
}

export const MODAL_POSITION_EVENT = "anfeta_modal_position_changed";

/**
 * Lee la configuración de posición vertical de modales desde localStorage.
 * Valores por defecto:
 * - top_high: 8px
 * - top: 20px
 * - custom: valor del slider en px (0 a 300px, defecto 8px)
 * - center: centrado vertical dinámico
 */
export function getModalPositionConfig(): ModalPositionConfig {
  if (typeof window === "undefined") {
    return { mode: "top_high", topOffset: 8 };
  }

  try {
    const rawMode = localStorage.getItem("anfeta_modal_position");
    const rawOffset = localStorage.getItem("anfeta_modal_top_offset");

    let mode: ModalPositionMode = "top_high";
    if (rawMode === "top_high" || rawMode === "top" || rawMode === "custom" || rawMode === "center") {
      mode = rawMode;
    }

    let topOffset = 8;
    if (rawOffset !== null) {
      const parsed = parseInt(rawOffset, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 400) {
        topOffset = parsed;
      }
    } else {
      if (mode === "top") topOffset = 20;
      else if (mode === "top_high") topOffset = 8;
    }

    return { mode, topOffset };
  } catch {
    return { mode: "top_high", topOffset: 8 };
  }
}

/**
 * Guarda la configuración de posición vertical y notifica inmediatamente a todos los componentes
 * (hover de tabla, modal de calendario fijado y hover de tarjetas de calendario).
 */
export function saveModalPositionConfig(config: { mode: ModalPositionMode; topOffset?: number }): void {
  if (typeof window === "undefined") return;

  try {
    const current = getModalPositionConfig();
    const mode = config.mode;
    let topOffset = config.topOffset !== undefined ? config.topOffset : current.topOffset;

    if (mode === "top_high" && config.topOffset === undefined) {
      topOffset = 8;
    } else if (mode === "top" && config.topOffset === undefined) {
      topOffset = 20;
    }

    // Clamp topOffset entre 0 y 350px
    topOffset = Math.max(0, Math.min(350, topOffset));

    localStorage.setItem("anfeta_modal_position", mode);
    localStorage.setItem("anfeta_modal_top_offset", String(topOffset));

    window.dispatchEvent(
      new CustomEvent(MODAL_POSITION_EVENT, {
        detail: { mode, topOffset },
      })
    );
  } catch (err) {
    console.warn("No se pudo guardar anfeta_modal_position:", err);
  }
}
