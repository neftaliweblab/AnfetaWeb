const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const folder = path.join(__dirname, '../browser-extension/anfeta-hotkey');
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '1.1.5');
assert.ok(manifest.permissions.includes('storage'));
assert.ok(manifest.permissions.includes('tabs'));
assert.equal(manifest.commands['toggle-anfeta'].global, true);
assert.equal(manifest.commands['toggle-anfeta'].suggested_key.default, 'Ctrl+Shift+8');
assert.equal(manifest.commands['toggle-buscador-calendario'].suggested_key.default, 'Ctrl+Shift+9');
assert.equal(manifest.commands['next-module'].suggested_key.default, 'Alt+Shift+M');
assert.ok(manifest.host_permissions.includes('https://anfeta-web.onrender.com/*'));
assert.ok(manifest.host_permissions.includes('https://*.onrender.com/*'));
assert.ok(manifest.content_scripts.some((entry) => Array.isArray(entry.js) && entry.js.includes('anfeta-bridge.js') && entry.matches.includes('https://anfeta-web.onrender.com/*')));
assert.ok(manifest.host_permissions.includes('https://anfeta-web.vercel.app/*'));
assert.ok(manifest.host_permissions.includes('https://anfeta-web-iota.vercel.app/*'));
assert.ok(manifest.host_permissions.includes('http://localhost:3000/*'));

let tabs = [];
let windows = new Map();
let store = {};
let created = 0;
let updates = [];
let activated = [];
let badge = '';
let sentMessages = [];
let command;
let action;
let lastFocusedId = undefined;
let windowRemovedCb = null;
let lastQueryUrl = null;

const chrome = {
  tabs: {
    query: async (query) => {
      lastQueryUrl = query.url;
      const patterns = Array.isArray(query.url) ? query.url : [query.url];
      return tabs.filter((t) => {
        if (!t.url) return true;
        return patterns.some((p) => t.url.startsWith(String(p).replace(/\*$/, '')));
      });
    },
    update: async (id, args) => activated.push({ id, ...args }),
    sendMessage: async (tabId, payload) => sentMessages.push({ tabId, payload }),
  },
  windows: {
    get: async (id) => {
      if (!windows.has(id)) throw Error('Window closed');
      return windows.get(id);
    },
    getLastFocused: async () => (lastFocusedId != null && windows.has(lastFocusedId) ? windows.get(lastFocusedId) : null),
    update: async (id, args) => {
      updates.push({ id, ...args });
      Object.assign(windows.get(id), args);
    },
    create: async (args) => {
      created++;
      assert.equal(args.type, 'popup');
      const win = { id: created, type: 'popup', focused: true, state: 'normal' };
      windows.set(win.id, win);
      lastFocusedId = win.id;
      tabs = [{ id: created, windowId: win.id, active: true, url: args.url }];
      return win;
    },
    onRemoved: {
      addListener: (fn) => {
        windowRemovedCb = fn;
      },
    },
  },
  storage: {
    local: {
      get: async (key) => {
        if (typeof key === 'string') return { [key]: store[key] };
        if (Array.isArray(key)) {
          const res = {};
          key.forEach((k) => {
            if (store[k] !== undefined) res[k] = store[k];
          });
          return res;
        }
        return store;
      },
      set: async (data) => Object.assign(store, data),
      remove: async (keys) => {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) delete store[k];
      },
    },
  },
  action: {
    setBadgeText: async (args) => {
      badge = args.text;
    },
    setTitle: async () => {},
    onClicked: {
      addListener: (fn) => {
        action = fn;
      },
    },
  },
  commands: {
    onCommand: {
      addListener: (fn) => {
        command = fn;
      },
    },
  },
  runtime: {
    onInstalled: { addListener: () => {} },
    onMessage: { addListener: () => {} },
    openOptionsPage: async () => {},
  },
};

const context = vm.createContext({ chrome, URL });
vm.runInContext(fs.readFileSync(path.join(folder, 'service-worker.js'), 'utf8'), context);
const toggle = () => vm.runInContext('toggleAnfeta()', context);

(async () => {
  // Test 1: Abrir una sola ventana dedicada con orígenes por defecto
  await Promise.all([toggle(), toggle()]);
  assert.equal(created, 1);
  assert.equal(store.managedWindowId, 1);
  assert.equal(tabs[0].url, 'https://anfeta-web.onrender.com/');
  assert.deepEqual(Array.from(lastQueryUrl), [
    'https://anfeta-web.onrender.com/*',
    'https://*.onrender.com/*',
    'https://anfeta-web.vercel.app/*',
    'https://anfeta-web-iota.vercel.app/*',
  ]);

  // Test 2: Minimizar ventana dedicada maximizada y conservar estado maximizado al restaurar
  windows.get(1).state = 'maximized';
  await toggle();
  assert.equal(windows.get(1).state, 'minimized');
  assert.equal(store.managedPrevState, 'maximized');

  await toggle();
  assert.equal(windows.get(1).state, 'maximized');
  assert.equal(windows.get(1).focused, true);

  // Test 3: Si no estaba enfocada, enfocar sin minimizar
  windows.get(1).focused = false;
  await toggle();
  assert.equal(windows.get(1).state, 'maximized');
  assert.equal(windows.get(1).focused, true);

  // Test 4: Detectar pestañas en /calendar, ?q=1 y origen secundario anfeta-web-iota.vercel.app
  store.managedWindowId = 999; // stale managedWindowId
  tabs = [
    {
      id: 7,
      windowId: 7,
      active: true,
      url: 'https://anfeta-web-iota.vercel.app/calendar?q=1#today',
    },
  ];
  windows.set(7, {
    id: 7,
    type: 'normal',
    focused: true,
    state: 'normal',
    tabs: [{ id: 7 }, { id: 70 }],
  });
  updates = [];
  await toggle();
  assert.equal(updates.some((a) => a.state === 'minimized'), false);
  assert.equal(activated.at(-1).id, 7);
  assert.equal(store.managedWindowId, undefined);

  // Test 5: Ventana normal con pestaña única de ANFETA se trata como dedicada
  tabs = [{ id: 8, windowId: 8, active: true, url: 'https://anfeta-web.vercel.app/calendar' }];
  windows.set(8, { id: 8, type: 'normal', focused: true, state: 'normal', tabs: [{ id: 8 }] });
  await toggle();
  assert.equal(windows.get(8).state, 'minimized');
  await toggle();
  assert.equal(windows.get(8).state, 'normal');

  // Limpiar managedWindowId con windows.onRemoved
  if (windowRemovedCb) await windowRemovedCb(8);
  assert.equal(store.managedWindowId, undefined);

  // Test 6: Soporte para customAppUrl con ruta y query (normaliza origin/* para matching)
  store.customAppUrl = 'http://localhost:3000/calendar?filter=mine';
  tabs = [];
  await toggle();
  assert.equal(lastQueryUrl, 'http://localhost:3000/*');
  assert.equal(tabs[0].url, 'http://localhost:3000/calendar?filter=mine');
  delete store.customAppUrl;

  // Test 7: Reabrir si se cerró la ventana
  tabs = [];
  await toggle();
  assert.equal(created, 3);

  // Test 8: Manejo de errores sin romper la extensión
  tabs = [{ id: 99, windowId: 99, url: 'https://anfeta-web.vercel.app/' }];
  await toggle();
  assert.equal(badge, '!');
  assert.ok(store.lastError);

  tabs = [];
  await toggle();
  assert.equal(badge, '');
  assert.equal(store.lastError, undefined);

  assert.equal(typeof command, 'function');
  assert.equal(typeof action, 'function');

  // Test 9: Cambio entre módulos desde la extensión en Render (sin minimizar ni duplicar ventana)
  tabs = [{ id: 12, windowId: 12, active: true, url: 'https://anfeta-web.onrender.com/' }];
  windows.set(12, { id: 12, type: 'popup', focused: true, state: 'normal', tabs: [{ id: 12 }] });
  sentMessages = [];
  await command('toggle-buscador-calendario');
  await new Promise((r) => setTimeout(r, 20));
  await command('next-module');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(windows.get(12).state, 'normal');
  assert.deepEqual(JSON.parse(JSON.stringify(sentMessages)), [
    { tabId: 12, payload: { action: 'ANFETA_SWITCH_MODULE', mode: 'toggle-search-calendar' } },
    { tabId: 12, payload: { action: 'ANFETA_SWITCH_MODULE', mode: 'cycle' } },
  ]);

  console.log('OK extensión v1.1.5: Render por defecto + múltiples orígenes, /calendar?q, stale managedWindowId, restauración maximizada, cambio de módulos y errores.');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
