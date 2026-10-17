const DEFAULT_URL = 'https://anfeta-web.vercel.app/';
let running = false;

async function getTargetUrl() {
  try {
    const { customAppUrl } = await chrome.storage.local.get('customAppUrl');
    if (customAppUrl && typeof customAppUrl === 'string' && customAppUrl.trim()) {
      return customAppUrl.trim().replace(/\/+$/, '') + '/';
    }
  } catch {}
  return DEFAULT_URL;
}

async function toggleAnfeta() {
  if (running) return;
  running = true;
  try {
    const appUrl = await getTargetUrl();
    const tabs = await chrome.tabs.query({ url: appUrl + '*' });
    const { managedWindowId } = await chrome.storage.local.get('managedWindowId');
    const tab = tabs.find(t => t.windowId === managedWindowId) || tabs.find(t => t.active) || tabs[0];
    if (tab) {
      const win = await chrome.windows.get(tab.windowId, { populate: true });
      // Minimizar solo una ventana dedicada; nunca ocultar pestañas ajenas.
      const dedicated = win.type === 'popup' || win.type === 'app' || (win.tabs?.length === 1 && win.tabs[0].id === tab.id);
      if (dedicated && win.focused && win.state !== 'minimized') {
        await chrome.windows.update(win.id, { state: 'minimized' });
      } else {
        await chrome.tabs.update(tab.id, { active: true });
        if (win.state === 'minimized') await chrome.windows.update(win.id, { state: 'normal' });
        await chrome.windows.update(win.id, { focused: true });
      }
    } else {
      const win = await chrome.windows.create({ url: appUrl, type: 'popup', width: 1400, height: 900, focused: true });
      await chrome.storage.local.set({ managedWindowId: win.id });
    }
    await chrome.storage.local.remove('lastError');
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Mostrar u ocultar ANFETA Web' });
  } catch (error) {
    await chrome.storage.local.set({ lastError: error instanceof Error ? error.message : String(error) });
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setTitle({ title: 'No se pudo abrir ANFETA. Revisa las opciones de la extensión.' });
  } finally {
    running = false;
  }
}

chrome.commands.onCommand.addListener(command => {
  if (command === 'toggle-anfeta') void toggleAnfeta();
});

chrome.action.onClicked.addListener(() => {
  void toggleAnfeta();
});

chrome.runtime.onInstalled?.addListener?.(async details => {
  if (details?.reason === 'install') await chrome.runtime.openOptionsPage?.();
});

if (chrome.runtime?.onMessage?.addListener) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action === 'SYNC_WHATSAPP_GROUPS') {
      (async () => {
        try {
          const appUrl = await getTargetUrl();
          const targetUrl = message.targetUrl || appUrl;
          const apiUrl = targetUrl.replace(/\/+$/, '') + '/api/whatsapp-directory';
          let res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groups: message.groups }),
          }).catch(() => null);

          if (!res || !res.ok) {
            const fallback = 'https://anfeta-web.vercel.app/api/whatsapp-directory';
            res = await fetch(fallback, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ groups: message.groups }),
            });
          }

          if (res.ok) {
            const data = await res.json();
            sendResponse({ ok: true, data });
          } else {
            sendResponse({ ok: false, error: `HTTP ${res.status}` });
          }
        } catch (err) {
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      })();
      return true;
    }
  });
}
