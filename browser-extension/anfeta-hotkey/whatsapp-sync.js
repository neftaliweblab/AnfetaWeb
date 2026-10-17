// Content script for https://web.whatsapp.com/*
// Reads project groups locally (read-only, zero risk) and syncs to ANFETA Web directory

(function () {
  const SCRIPT_ID = "anfeta-whatsapp-sync-widget";
  if (document.getElementById(SCRIPT_ID)) return;

  function createNotification(msg, isSuccess = true) {
    const existing = document.getElementById("anfeta-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "anfeta-toast";
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 999999;
      background: ${isSuccess ? "#0F281E" : "#2E1114"};
      color: ${isSuccess ? "#4ADE80" : "#FCA5A5"};
      border: 1px solid ${isSuccess ? "#22C55E" : "#EF4444"};
      padding: 12px 18px;
      border-radius: 10px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: anfetaFadeIn 0.2s ease-out;
    `;
    toast.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  async function getTargetAnfetaUrl() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const { customAppUrl } = await chrome.storage.local.get("customAppUrl");
        if (customAppUrl && typeof customAppUrl === "string" && customAppUrl.trim()) {
          return customAppUrl.trim().replace(/\/+$/, "") + "/";
        }
      }
    } catch {}
    // Default to localhost, fallback to vercel
    return "http://localhost:3000/";
  }

  async function extractGroupsFromIndexedDB() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open("model-storage");
        req.onerror = () => resolve([]);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("chat")) {
            resolve([]);
            return;
          }
          const tx = db.transaction("chat", "readonly");
          const store = tx.objectStore("chat");
          const allReq = store.getAll();
          allReq.onerror = () => resolve([]);
          allReq.onsuccess = () => {
            const rows = allReq.result || [];
            const groups = [];
            for (const c of rows) {
              const id = String(c.id || "");
              const isGroup = c.isGroup === true || id.endsWith("@g.us");
              if (!isGroup) continue;

              const name = String(c.formattedTitle || c.name || "").trim();
              if (!name) continue;

              groups.push({
                id: id,
                name: name,
                unreadCount: typeof c.unreadCount === "number" ? c.unreadCount : 0,
              });
            }
            resolve(groups);
          };
        };
      } catch {
        resolve([]);
      }
    });
  }

  function extractGroupsFromDOM() {
    const list = [];
    const elements = document.querySelectorAll('#pane-side div[role="listitem"], #pane-side div[data-testid="cell-frame-container"]');
    elements.forEach((el) => {
      const titleEl = el.querySelector('span[title], [data-testid="cell-frame-title"]');
      if (titleEl) {
        const name = titleEl.getAttribute("title") || titleEl.textContent || "";
        if (name && name.length >= 2) {
          list.push({
            id: `dom_${name.toLowerCase().replace(/\s+/g, "_")}`,
            name: name.trim(),
          });
        }
      }
    });
    return list;
  }

  async function syncGroups() {
    const btn = document.getElementById(SCRIPT_ID);
    if (btn) btn.textContent = "⏳ Sincronizando…";

    try {
      let groups = await extractGroupsFromIndexedDB();
      if (!groups.length) {
        groups = extractGroupsFromDOM();
      }

      if (!groups.length) {
        createNotification("⚠️ No se detectaron grupos en WhatsApp Web. Asegúrate de tener los chats cargados.", false);
        if (btn) btn.textContent = "⚡ Sincronizar con ANFETA";
        return;
      }

      const targetUrl = await getTargetAnfetaUrl();
      const endpoint = `${targetUrl}api/whatsapp-directory`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
      });

      if (!response.ok) {
        // Try fallback to production url if localhost failed
        if (targetUrl.includes("localhost")) {
          const fallback = "https://anfeta-web.vercel.app/api/whatsapp-directory";
          const res2 = await fetch(fallback, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groups }),
          });
          if (res2.ok) {
            createNotification(`✅ ¡${groups.length} grupos sincronizados en ANFETA Web!`);
            if (btn) btn.textContent = "✓ Sincronizado";
            setTimeout(() => { if (btn) btn.textContent = "⚡ Sincronizar con ANFETA"; }, 3000);
            return;
          }
        }
        throw new Error("No se pudo conectar con la API de ANFETA.");
      }

      const data = await response.json();
      createNotification(`✅ ¡${data.count || groups.length} grupos sincronizados en ANFETA!`);
      if (btn) btn.textContent = "✓ Sincronizado";
      setTimeout(() => { if (btn) btn.textContent = "⚡ Sincronizar con ANFETA"; }, 3000);
    } catch (err) {
      console.error("[ANFETA Sync]", err);
      createNotification("❌ Error de sincronización. Verifica que ANFETA esté abierto.", false);
      if (btn) btn.textContent = "⚡ Reintentar sincronizar";
    }
  }

  // Inject Floating Sync Pill
  function injectWidget() {
    if (document.getElementById(SCRIPT_ID)) return;

    const btn = document.createElement("button");
    btn.id = SCRIPT_ID;
    btn.textContent = "⚡ Sincronizar con ANFETA";
    btn.title = "Sincroniza tus grupos de proyectos con el directorio de ANFETA (100% seguro, sin bots)";
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 99999;
      background: #0B131E;
      color: #38BDF8;
      border: 1px solid #0284C7;
      padding: 8px 14px;
      border-radius: 20px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#0284C7";
      btn.style.color = "#FFFFFF";
      btn.style.transform = "translateY(-1px)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.background = "#0B131E";
      btn.style.color = "#38BDF8";
      btn.style.transform = "translateY(0)";
    });

    btn.addEventListener("click", syncGroups);

    document.body.appendChild(btn);
  }

  // Wait for WhatsApp Web to load
  const checkInterval = setInterval(() => {
    if (document.querySelector("#pane-side, #app")) {
      injectWidget();
      clearInterval(checkInterval);
    }
  }, 1500);
})();
