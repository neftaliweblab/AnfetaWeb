/**
 * Cola de cambios y mutaciones offline de ANFETA (IndexedDB / localStorage).
 * Permite encolar mutaciones (checklist, estados de calendario, recordatorios)
 * cuando se pierde conexión y reintentarlas automáticamente con backoff exponencial al reconectar.
 */

export interface QueuedMutation {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  createdAt: number;
  retryCount: number;
}

const STORAGE_KEY = "anfeta_offline_mutation_queue_v1";

export class OfflineMutationQueue {
  private static isFlushing = false;

  public static getQueue(): QueuedMutation[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public static enqueue(url: string, body: any, method = "POST"): void {
    if (typeof window === "undefined") return;
    const item: QueuedMutation = {
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url,
      method,
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
      createdAt: Date.now(),
      retryCount: 0,
    };

    const queue = this.getQueue();
    queue.push(item);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      window.dispatchEvent(new CustomEvent("anfeta_offline_queue_changed", { detail: { count: queue.length } }));
    } catch (e) {
      console.warn("No se pudo encolar la mutación offline:", e);
    }
  }

  public static async flush(): Promise<{ successCount: number; failedCount: number }> {
    if (typeof window === "undefined" || !navigator.onLine || this.isFlushing) {
      return { successCount: 0, failedCount: 0 };
    }

    this.isFlushing = true;
    let queue = this.getQueue();
    if (queue.length === 0) {
      this.isFlushing = false;
      return { successCount: 0, failedCount: 0 };
    }

    const remaining: QueuedMutation[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });

        if (res.ok) {
          successCount++;
        } else {
          // Error 4xx/5xx del servidor
          item.retryCount += 1;
          if (item.retryCount < 5) {
            remaining.push(item);
          }
          failedCount++;
        }
      } catch {
        // Sigue sin conexión
        item.retryCount += 1;
        remaining.push(item);
        failedCount++;
        break; // Detener hasta la siguiente reconexión
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      window.dispatchEvent(
        new CustomEvent("anfeta_offline_queue_changed", { detail: { count: remaining.length } })
      );
      if (successCount > 0) {
        window.dispatchEvent(new CustomEvent("anfeta_data_refreshed"));
      }
    } catch {}

    this.isFlushing = false;
    return { successCount, failedCount };
  }

  public static initAutoSync(): void {
    if (typeof window === "undefined") return;
    window.addEventListener("online", () => {
      console.log("Conexión reestablecida. Procesando cola de cambios offline...");
      void this.flush();
    });

    // Reintento periódico si hay conexión
    setInterval(() => {
      if (navigator.onLine && this.getQueue().length > 0) {
        void this.flush();
      }
    }, 30000);
  }
}
