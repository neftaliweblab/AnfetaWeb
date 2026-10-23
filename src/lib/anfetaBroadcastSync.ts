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
  messageId?:string;
  confirmed?:boolean;
  query?: string;
  date?: string;
  domain?: string;
  pageId?: string;
  activity?: any;
  activities?: any[];
  updates?: any;
  sourceWindow?: "main" | "calendar";
  timestamp?: number;
  readStartedAt?:number;
}

const CHANNEL_NAME = "anfeta_multiwindow_channel";

export class AnfetaSyncService {
  private seen=new Set<string>();
  private clientId=Math.random().toString(36).slice(2);
  private sequence=0;
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
      messageId:this.clientId+':'+(++this.sequence),
      ...(msg.confirmed&&msg.updates?{updates:{...msg.updates,localConfirmedAt:Date.now()}}:{}),
      ...(msg.confirmed&&msg.activity?{activity:{...msg.activity,localConfirmedAt:Date.now()}}:{}),
      timestamp: Date.now(),
    };

    this.notifyListeners(payload);
    if(msg.confirmed&&typeof window!=='undefined')window.dispatchEvent(new Event('anfeta_activity_saved'));
    let sent=false;
    if (this.channel) {
      try {
        this.channel.postMessage(payload);sent=true;
      } catch (err) {
        console.warn("Error enviando BroadcastChannel:", err);
      }
    }

    if (!sent && typeof window !== "undefined") {
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
    if(data.messageId){if(this.seen.has(data.messageId))return;this.seen.add(data.messageId);if(this.seen.size>512)this.seen.delete(this.seen.values().next().value!);}
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
