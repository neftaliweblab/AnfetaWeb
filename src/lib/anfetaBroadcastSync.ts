/**
 * Servicio de sincronización en tiempo real multi-ventana para ANFETA.
 * Permite comunicar el Buscador Principal con la Ventana Independiente de Calendario (Multi-Monitor)
 * usando BroadcastChannel con fallback en LocalStorage.
 */

export interface AnfetaSyncMessage {
  type:
    | "SYNC_QUERY"
    | "SYNC_DATE"
    | "SYNC_SELECT_DOMAIN"
    | "CALENDAR_STANDALONE_READY"
    | "ACTIVITY_UPDATED"
    | "ACTIVITY_CREATED"
    | "CALENDAR_REFRESHED"
    | "REMINDERS_CHANGED";
  query?: string;
  date?: string;
  domain?: string;
  pageId?: string;
  activity?: any;
  activities?: any[];
  updates?: any;
  sourceWindow?: "main" | "calendar";
  timestamp?: number;
}

const CHANNEL_NAME = "anfeta_multiwindow_channel";

class AnfetaSyncService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(msg: AnfetaSyncMessage) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        if ("BroadcastChannel" in window) {
          this.channel = new BroadcastChannel(CHANNEL_NAME);
          this.channel.onmessage = (event) => {
            this.notifyListeners(event.data);
          };
        }
      } catch (e) {
        console.warn("BroadcastChannel no soportado, usando Storage fallback:", e);
      }

      window.addEventListener("storage", (e) => {
        if (e.key === "anfeta_sync_event" && e.newValue) {
          try {
            const data: AnfetaSyncMessage = JSON.parse(e.newValue);
            this.notifyListeners(data);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  public broadcast(msg: AnfetaSyncMessage) {
    const payload = {
      ...msg,
      timestamp: Date.now(),
    };

    this.notifyListeners(payload);
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (err) {
        console.warn("Error enviando BroadcastChannel:", err);
      }
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("anfeta_sync_event", JSON.stringify(payload));
      } catch {
        // ignore
      }
    }
  }

  public subscribe(callback: (msg: AnfetaSyncMessage) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(data: AnfetaSyncMessage) {
    if (!data) return;
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error("Error en listener de sincronización:", err);
      }
    });
  }
}

export const anfetaSync = new AnfetaSyncService();
