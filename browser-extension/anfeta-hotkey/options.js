const DEFAULT_URL = 'https://anfeta-web.onrender.com/';

function sanitizeAppUrl(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { ok: true, value: DEFAULT_URL, isDefault: true };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'La URL debe empezar con https:// o http://' };
    }
    return { ok: true, value: `${parsed.origin}/`, isDefault: false };
  } catch {
    return { ok: false, error: 'URL inválida. Ejemplo válido: https://anfeta-web.onrender.com/' };
  }
}

async function load() {
  try {
    const commands = await chrome.commands.getAll();
    const toggle = commands.find((c) => c.name === 'toggle-anfeta');
    const switchBC = commands.find((c) => c.name === 'toggle-buscador-calendario');
    const nextMod = commands.find((c) => c.name === 'next-module');
    const shortcutEl = document.getElementById('shortcut');
    const parts = [
      toggle?.shortcut ? `Ventana: ${toggle.shortcut}` : null,
      switchBC?.shortcut ? `Buscador↔Cal: ${switchBC.shortcut}` : null,
      nextMod?.shortcut ? `Siguiente módulo: ${nextMod.shortcut}` : null,
    ].filter(Boolean);
    if (parts.length > 0) {
      shortcutEl.textContent = parts.join(' · ');
      document.getElementById('scopeHint').textContent =
        'Comprueba que "Mostrar u ocultar ANFETA Web" tenga alcance Global. Los atajos de módulo enfocan ANFETA y cambian la vista al instante.';
    } else {
      shortcutEl.textContent = 'No asignado — Pulsa el botón abajo para configurarlo.';
    }
  } catch {
    document.getElementById('shortcut').textContent = 'Error al consultar atajos.';
  }

  const { lastError, customAppUrl } = await chrome.storage.local.get(['lastError', 'customAppUrl']);
  document.getElementById('error').textContent = lastError || '';
  document.getElementById('appUrl').value = customAppUrl || DEFAULT_URL;
}

document.getElementById('saveUrl').addEventListener('click', async () => {
  const status = document.getElementById('saveStatus');
  const errEl = document.getElementById('error');
  const check = sanitizeAppUrl(document.getElementById('appUrl').value);
  if (!check.ok) {
    errEl.textContent = check.error;
    status.textContent = '';
    return;
  }
  errEl.textContent = '';
  document.getElementById('appUrl').value = check.value;
  if (check.isDefault) {
    await chrome.storage.local.remove('customAppUrl');
  } else {
    await chrome.storage.local.set({ customAppUrl: check.value });
  }
  status.textContent = 'Guardado';
  setTimeout(() => {
    status.textContent = '';
  }, 2000);
});

document.getElementById('resetUrl').addEventListener('click', async () => {
  document.getElementById('appUrl').value = DEFAULT_URL;
  document.getElementById('error').textContent = '';
  await chrome.storage.local.remove('customAppUrl');
  const status = document.getElementById('saveStatus');
  status.textContent = 'Restablecido';
  setTimeout(() => {
    status.textContent = '';
  }, 2000);
});

document.getElementById('configure').addEventListener('click', () => {
  const isEdge = navigator.userAgent.includes('Edg/');
  const isBrave = navigator.brave && typeof navigator.brave.isBrave === 'function';
  const url = isEdge
    ? 'edge://extensions/shortcuts'
    : isBrave
      ? 'brave://extensions/shortcuts'
      : 'chrome://extensions/shortcuts';
  void chrome.tabs.create({ url }).catch(() => {
    alert('Abre ' + url + ' en una pestaña nueva para configurar los atajos.');
  });
});

void load();
