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

          const metadataMap = new Map();
          const readMetadataThenChats = () => {
            try {
              const tx = db.transaction("chat", "readonly");
              const store = tx.objectStore("chat");
              const allReq = store.getAll();
              allReq.onerror = () => resolve([]);
              allReq.onsuccess = () => {
                const rows = allReq.result || [];
                const groups = [];
                for (const c of rows) {
                  const rawId = c.id;
                  const id = String(rawId?._serialized || (typeof rawId === "string" ? rawId : "")).trim();
                  const isGroup = c.isGroup === true || id.endsWith("@g.us") || id.includes("@g.us");
                  if (!isGroup) continue;

                  const name = String(c.formattedTitle || c.name || c.contact?.name || "").trim();
                  if (!name) continue;

                  const meta = metadataMap.get(id) || metadataMap.get(rawId?._serialized) || metadataMap.get(rawId?.user);
                  let inviteUrl = undefined;
                  if (meta && (meta.inviteCode || meta.groupMetadata?.inviteCode)) {
                    inviteUrl = `https://chat.whatsapp.com/${meta.inviteCode || meta.groupMetadata?.inviteCode}`;
                  } else {
                    const descText = String(meta?.desc || meta?.description || c.desc || "");
                    const linkMatch = descText.match(/https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9_-]+/i);
                    if (linkMatch) {
                      inviteUrl = linkMatch[0];
                    }
                  }

                  groups.push({
                    id: id || `group_${Math.random().toString(36).slice(2, 8)}@g.us`,
                    name: name,
                    inviteUrl: inviteUrl,
                    participantsCount: Array.isArray(meta?.participants) ? meta.participants.length : undefined,
                    owner: meta?.owner ? String(meta.owner?._serialized || meta.owner) : undefined,
                    unreadCount: typeof c.unreadCount === "number" ? c.unreadCount : 0,
                    lastSynced: new Date().toISOString(),
                  });
                }
                resolve(groups);
              };
            } catch {
              resolve([]);
            }
          };

          if (db.objectStoreNames.contains("group-metadata")) {
            try {
              const metaTx = db.transaction("group-metadata", "readonly");
              const metaStore = metaTx.objectStore("group-metadata");
              const metaReq = metaStore.getAll();
              metaReq.onsuccess = () => {
                for (const m of metaReq.result || []) {
                  if (m && m.id) {
                    const mid = String(m.id?._serialized || (typeof m.id === "string" ? m.id : "")).trim();
                    if (mid) metadataMap.set(mid, m);
                  }
                }
                readMetadataThenChats();
              };
              metaReq.onerror = () => readMetadataThenChats();
            } catch {
              readMetadataThenChats();
            }
          } else {
            readMetadataThenChats();
          }
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

      // Delegate network request to background service worker to completely bypass page CSP
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(
          { action: "SYNC_WHATSAPP_GROUPS", groups, targetUrl },
          (resp) => {
            if (resp && resp.ok) {
              const count = resp.data?.count || groups.length;
              createNotification(`✅ ¡${count} grupos sincronizados en ANFETA!`);
              if (btn) btn.textContent = "✓ Sincronizado";
              setTimeout(() => { if (btn) btn.textContent = "⚡ Sincronizar con ANFETA"; }, 3000);
            } else {
              // Copy to clipboard fallback if extension background failed
              try {
                navigator.clipboard.writeText(JSON.stringify({ groups }));
                createNotification(`📋 ${groups.length} grupos copiados. Pégalos en ANFETA.`);
              } catch {}
              createNotification("❌ Error conectando con ANFETA.", false);
              if (btn) btn.textContent = "⚡ Reintentar sincronizar";
            }
          }
        );
        return;
      }

      // If chrome.runtime is not available (e.g. running in browser console directly), copy to clipboard
      try {
        navigator.clipboard.writeText(JSON.stringify({ groups, total: groups.length }, null, 2));
        createNotification(`📋 ${groups.length} grupos copiados al portapapeles. Pégalos en ANFETA.`);
        if (btn) btn.textContent = "✓ Copiado";
      } catch {
        createNotification("No se pudo copiar automáticamente.", false);
      }
    } catch (err) {
      console.error("[ANFETA Sync]", err);
      createNotification("❌ Error de sincronización.", false);
      if (btn) btn.textContent = "⚡ Reintentar";
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
