const DEFAULT_URL = 'https://anfeta-web.vercel.app/';

async function load() {
  try {
    const commands = await chrome.commands.getAll();
    const command = commands.find(c => c.name === 'toggle-anfeta');
    const shortcutEl = document.getElementById('shortcut');
    if (command && command.shortcut) {
      shortcutEl.textContent = 'Atajo asignado: ' + command.shortcut + (command.global ? ' (Global)' : ' (Solo en navegador)');
    } else {
      shortcutEl.textContent = 'No asignado — Pulsa el botón abajo para configurarlo.';
    }
  } catch (e) {
    document.getElementById('shortcut').textContent = 'Error al consultar atajos.';
  }

  const { lastError, customAppUrl } = await chrome.storage.local.get(['lastError', 'customAppUrl']);
  document.getElementById('error').textContent = lastError || '';
  document.getElementById('appUrl').value = customAppUrl || DEFAULT_URL;
}

document.getElementById('saveUrl').addEventListener('click', async () => {
  const url = document.getElementById('appUrl').value.trim() || DEFAULT_URL;
  await chrome.storage.local.set({ customAppUrl: url });
  const status = document.getElementById('saveStatus');
  status.textContent = 'Guardado';
  setTimeout(() => { status.textContent = ''; }, 2000);
});

document.getElementById('resetUrl').addEventListener('click', async () => {
  document.getElementById('appUrl').value = DEFAULT_URL;
  await chrome.storage.local.remove('customAppUrl');
  const status = document.getElementById('saveStatus');
  status.textContent = 'Restablecido';
  setTimeout(() => { status.textContent = ''; }, 2000);
});

document.getElementById('configure').addEventListener('click', () => {
  const isEdge = navigator.userAgent.includes('Edg/');
  const isBrave = (navigator.brave && typeof navigator.brave.isBrave === 'function');
  const url = isEdge ? 'edge://extensions/shortcuts' : (isBrave ? 'brave://extensions/shortcuts' : 'chrome://extensions/shortcuts');
  void chrome.tabs.create({ url }).catch(() => {
    alert('Abre ' + url + ' en una pestaña nueva para configurar los atajos.');
  });
});

void load();
