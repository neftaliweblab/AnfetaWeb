const DEFAULT_URL = 'https://anfeta-web.vercel.app/';
const KNOWN_ORIGINS = [
  'https://anfeta-web.vercel.app/*',
  'https://anfeta-web-iota.vercel.app/*',
];

let inFlightToggle = null;

function normalizeTargetUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return {
      openUrl: parsed.href,
      originUrl: `${parsed.origin}/`,
      queryPattern: `${parsed.origin}/*`,
    };
  } catch {
    return null;
  }
}

async function getTargetConfig() {
  try {
    const { customAppUrl } = await chrome.storage.local.get('customAppUrl');
    const normalized = normalizeTargetUrl(customAppUrl);
    if (normalized) {
      return {
        openUrl: normalized.openUrl,
        originUrl: normalized.originUrl,
        queryUrl: normalized.queryPattern,
        isCustom: true,
      };
    }
  } catch {}
  return {
    openUrl: DEFAULT_URL,
    originUrl: DEFAULT_URL,
    queryUrl: KNOWN_ORIGINS,
    isCustom: false,
  };
}

function selectBestAnfetaTab(tabs, managedWindowId, focusedWindowId) {
  if (!Array.isArray(tabs) || tabs.length === 0) return null;
  if (typeof managedWindowId === 'number') {
    const managedActive = tabs.find((t) => t.windowId === managedWindowId && t.active);
    if (managedActive) return managedActive;
    const managedAny = tabs.find((t) => t.windowId === managedWindowId);
    if (managedAny) return managedAny;
  }
  if (typeof focusedWindowId === 'number') {
    const focusedActive = tabs.find((t) => t.windowId === focusedWindowId && t.active);
    if (focusedActive) return focusedActive;
    const focusedAny = tabs.find((t) => t.windowId === focusedWindowId);
    if (focusedAny) return focusedAny;
  }
  return tabs.find((t) => t.active) || tabs[0];
}

function matchesConfigOrigin(tabUrl, config) {
  if (!tabUrl || typeof tabUrl !== 'string') return true;
  if (config.isCustom) return tabUrl.startsWith(config.originUrl);
  return KNOWN_ORIGINS.some((pattern) => tabUrl.startsWith(pattern.replace(/\*$/, '')));
}

async function runToggleAnfeta() {
  try {
    const config = await getTargetConfig();
    const queriedTabs = await chrome.tabs.query({ url: config.queryUrl });
    const tabs = Array.isArray(queriedTabs)
      ? queriedTabs.filter((t) => matchesConfigOrigin(t.url, config))
      : [];

    const { managedWindowId, managedPrevState } = await chrome.storage.local.get([
      'managedWindowId',
      'managedPrevState',
    ]);

    let validManagedId = undefined;
    if (typeof managedWindowId === 'number') {
      try {
        await chrome.windows.get(managedWindowId);
        validManagedId = managedWindowId;
      } catch {
        await chrome.storage.local.remove(['managedWindowId', 'managedPrevState']);
      }
    }

    let focusedWindowId = undefined;
    try {
      const lastFocused = await chrome.windows.getLastFocused?.();
      if (lastFocused && typeof lastFocused.id === 'number') focusedWindowId = lastFocused.id;
    } catch {}

    const tab = selectBestAnfetaTab(tabs, validManagedId, focusedWindowId);
    if (tab) {
      const win = await chrome.windows.get(tab.windowId, { populate: true });
      // Minimizar solo una ventana dedicada; nunca ocultar pestañas ajenas.
      const dedicated =
        win.type === 'popup' ||
        win.type === 'app' ||
        (Array.isArray(win.tabs) && win.tabs.length === 1 && win.tabs[0].id === tab.id);

      if (dedicated && win.focused && win.state !== 'minimized') {
        const stateBeforeMinimize =
          win.state === 'maximized' || win.state === 'fullscreen' ? win.state : 'normal';
        await chrome.storage.local.set({
          managedWindowId: win.id,
          managedPrevState: stateBeforeMinimize,
        });
        await chrome.windows.update(win.id, { state: 'minimized' });
      } else {
        await chrome.tabs.update(tab.id, { active: true });
        if (win.state === 'minimized') {
          const restoreState =
            managedPrevState === 'maximized' || managedPrevState === 'fullscreen'
              ? managedPrevState
              : 'normal';
          await chrome.windows.update(win.id, { state: restoreState, focused: true });
        } else {
          await chrome.windows.update(win.id, { focused: true });
        }
        if (dedicated) {
          await chrome.storage.local.set({ managedWindowId: win.id });
        }
      }
    } else {
      const win = await chrome.windows.create({
        url: config.openUrl,
        type: 'popup',
        width: 1400,
        height: 900,
        focused: true,
      });
      await chrome.storage.local.set({ managedWindowId: win.id, managedPrevState: 'normal' });
    }

    await chrome.storage.local.remove('lastError');
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Mostrar u ocultar ANFETA Web' });
  } catch (error) {
    await chrome.storage.local.set({
      lastError: error instanceof Error ? error.message : String(error),
    });
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setTitle({
      title: 'No se pudo abrir ANFETA. Revisa las opciones de la extensión.',
    });
  }
}

function toggleAnfeta() {
  if (inFlightToggle) return inFlightToggle;
  inFlightToggle = runToggleAnfeta().finally(() => {
    inFlightToggle = null;
  });
  return inFlightToggle;
}

chrome.windows?.onRemoved?.addListener?.(async (windowId) => {
  try {
    const { managedWindowId } = await chrome.storage.local.get('managedWindowId');
    if (managedWindowId === windowId) {
      await chrome.storage.local.remove(['managedWindowId', 'managedPrevState']);
    }
  } catch {}
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-anfeta') void toggleAnfeta();
});

chrome.action.onClicked.addListener(() => {
  void toggleAnfeta();
});

chrome.runtime.onInstalled?.addListener?.(async (details) => {
  if (details?.reason === 'install') await chrome.runtime.openOptionsPage?.();
});

if (chrome.runtime?.onMessage?.addListener) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action === 'SYNC_WHATSAPP_GROUPS') {
      (async () => {
        try {
          const config = await getTargetConfig();
          const preferred = normalizeTargetUrl(message.targetUrl)?.originUrl || config.originUrl;
          const candidates = Array.from(
            new Set([
              preferred,
              'https://anfeta-web.vercel.app/',
              'https://anfeta-web-iota.vercel.app/',
            ])
          );
          let res = null;
          for (const base of candidates) {
            const apiUrl = base.replace(/\/+$/, '') + '/api/whatsapp-directory';
            res = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ groups: message.groups }),
            }).catch(() => null);
            if (res && res.ok) break;
          }

          if (res && res.ok) {
            const data = await res.json();
            sendResponse({ ok: true, data });
          } else {
            sendResponse({ ok: false, error: res ? `HTTP ${res.status}` : 'Sin conexión' });
          }
        } catch (err) {
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      })();
      return true;
    }
  });
}
