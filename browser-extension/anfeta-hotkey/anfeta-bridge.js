(() => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

  const MODULES = ['results', 'calendar', 'dailyProgress', 'messages', 'reminders'];

  function fallbackDomSwitch(mode) {
    try {
      const buttons = Array.from(document.querySelectorAll('button[data-anfeta-view]'));
      if (buttons.length > 0) {
        const currentView = (() => {
          try {
            return localStorage.getItem('anfeta_active_view') || 'results';
          } catch {
            return 'results';
          }
        })();
        let target = mode;
        if (mode === 'toggle-search-calendar') {
          target = currentView === 'calendar' ? 'results' : 'calendar';
        } else if (mode === 'cycle') {
          const idx = MODULES.indexOf(currentView);
          target = MODULES[(idx + 1) % MODULES.length];
        }
        const btn = document.querySelector(`button[data-anfeta-view="${target}"]`);
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
      }
      if (window.location.pathname.startsWith('/calendar')) {
        window.location.href = '/?view=results';
        return true;
      }
    } catch {}
    return false;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action !== 'ANFETA_SWITCH_MODULE') return;
    const mode = message.mode || 'toggle-search-calendar';
    try {
      window.dispatchEvent(new CustomEvent('anfeta:extension-module', { detail: { mode } }));
      if (!document.querySelector('button[data-anfeta-view]') && window.location.pathname.startsWith('/calendar')) {
        fallbackDomSwitch(mode);
      }
      sendResponse({ ok: true });
    } catch (error) {
      const usedFallback = fallbackDomSwitch(mode);
      sendResponse({ ok: usedFallback, error: error instanceof Error ? error.message : String(error) });
    }
    return false;
  });
})();
