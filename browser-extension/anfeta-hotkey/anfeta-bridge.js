(() => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

  const MODULES = ['results', 'calendar', 'dailyProgress', 'messages', 'reminders'];
  const ARIA_BY_MODULE = {
    results: 'Buscador',
    calendar: 'Calendario',
    dailyProgress: 'Avance Diario',
    messages: 'Mensajes',
    reminders: 'Recordatorios',
  };

  function detectCurrentView() {
    for (const view of MODULES) {
      const btn =
        document.querySelector(`button[data-anfeta-view="${view}"]`) ||
        document.querySelector(`button[aria-label="${ARIA_BY_MODULE[view]}"]`);
      if (btn && typeof btn.className === 'string' && btn.className.includes('bg-[#18212B]')) {
        return view;
      }
    }
    try {
      const saved = localStorage.getItem('anfeta_active_view');
      if (saved && MODULES.includes(saved)) return saved;
    } catch {}
    if (window.location.pathname.startsWith('/calendar')) return 'calendar';
    return 'results';
  }

  function resolveTargetView(mode) {
    const currentView = detectCurrentView();
    if (mode === 'toggle-search-calendar') {
      return currentView === 'calendar' ? 'results' : 'calendar';
    }
    if (mode === 'cycle') {
      const idx = MODULES.indexOf(currentView);
      return MODULES[(idx + 1) % MODULES.length];
    }
    return MODULES.includes(mode) ? mode : 'results';
  }

  function fallbackDomSwitch(mode) {
    try {
      const target = resolveTargetView(mode);
      if (window.location.pathname.startsWith('/calendar')) {
        if (target !== 'calendar') {
          window.location.href = '/?view=' + encodeURIComponent(target);
        }
        return true;
      }
      const btn =
        document.querySelector(`button[data-anfeta-view="${target}"]`) ||
        document.querySelector(`button[aria-label="${ARIA_BY_MODULE[target]}"]`);
      if (btn instanceof HTMLElement) {
        btn.click();
        if (target === 'results') {
          requestAnimationFrame(() => {
            const input = document.getElementById('anfeta-search-input');
            if (input instanceof HTMLInputElement) {
              input.focus();
              input.select();
            }
          });
        }
        return true;
      }
    } catch {}
    return false;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action !== 'ANFETA_SWITCH_MODULE') return;
    const mode = message.mode || 'toggle-search-calendar';
    const before = detectCurrentView();
    try {
      // window.postMessage crosses MV3 ISOLATED -> MAIN world without stripping payload properties.
      window.postMessage({ type: 'ANFETA_EXTENSION_MODULE', mode }, '*');
      setTimeout(() => {
        if (detectCurrentView() === before) {
          fallbackDomSwitch(mode);
        }
      }, 40);
      sendResponse({ ok: true });
    } catch (error) {
      const usedFallback = fallbackDomSwitch(mode);
      sendResponse({ ok: usedFallback, error: error instanceof Error ? error.message : String(error) });
    }
    return false;
  });
})();
