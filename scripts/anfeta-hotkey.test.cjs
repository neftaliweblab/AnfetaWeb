const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const folder = path.join(__dirname, '../browser-extension/anfeta-hotkey');
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.commands['toggle-anfeta'].global, true);
assert.equal(manifest.commands['toggle-anfeta'].suggested_key.default, 'Ctrl+Shift+8');
assert.ok(manifest.host_permissions.includes('https://anfeta-web.vercel.app/*'));
assert.ok(manifest.host_permissions.includes('http://localhost:3000/*'));

let tabs = [];
let windows = new Map();
let store = {};
let created = 0;
let updates = [];
let activated = [];
let badge = '';
let command;
let action;
let lastQueryUrl = '';

const chrome = {
  tabs: {
    query: async query => {
      lastQueryUrl = query.url;
      return tabs;
    },
    update: async (id, args) => activated.push({ id, ...args })
  },
  windows: {
    get: async id => {
      if (!windows.has(id)) throw Error('Window closed');
      return windows.get(id);
    },
    update: async (id, args) => {
      updates.push({ id, ...args });
      Object.assign(windows.get(id), args);
    },
    create: async args => {
      created++;
      assert.equal(args.type, 'popup');
      const win = { id: created, type: 'popup', focused: true, state: 'normal' };
      windows.set(win.id, win);
      tabs = [{ id: created, windowId: win.id, active: true }];
      return win;
    }
  },
  storage: {
    local: {
      get: async key => {
        if (typeof key === 'string') return { [key]: store[key] };
        if (Array.isArray(key)) {
          const res = {};
          key.forEach(k => { if (store[k] !== undefined) res[k] = store[k]; });
          return res;
        }
        return store;
      },
      set: async data => Object.assign(store, data),
      remove: async key => delete store[key]
    }
  },
  action: {
    setBadgeText: async args => { badge = args.text; },
    setTitle: async () => {},
    onClicked: { addListener: fn => { action = fn; } }
  },
  commands: {
    onCommand: { addListener: fn => { command = fn; } }
  },
  runtime: {
    onInstalled: { addListener: () => {} },
    openOptionsPage: async () => {}
  }
};

const context = vm.createContext({ chrome });
vm.runInContext(fs.readFileSync(path.join(folder, 'service-worker.js'), 'utf8'), context);
const toggle = () => vm.runInContext('toggleAnfeta()', context);

(async () => {
  // Test 1: Abrir una sola ventana dedicada con URL por defecto
  await Promise.all([toggle(), toggle()]);
  assert.equal(created, 1);
  assert.equal(store.managedWindowId, 1);
  assert.equal(lastQueryUrl, 'https://anfeta-web.vercel.app/*');

  // Test 2: Minimizar ventana dedicada si está al frente
  await toggle();
  assert.equal(windows.get(1).state, 'minimized');

  // Test 3: Restaurar ventana dedicada si está minimizada
  await toggle();
  assert.equal(windows.get(1).state, 'normal');
  assert.equal(windows.get(1).focused, true);

  // Test 4: Si no estaba enfocada, enfocar sin minimizar
  windows.get(1).focused = false;
  await toggle();
  assert.equal(windows.get(1).state, 'normal');

  // Test 5: Pestaña normal compartida: solo enfocar, jamás minimizar pestañas de otros sitios
  tabs = [{ id: 8, windowId: 8, active: false }];
  windows.set(8, { id: 8, type: 'normal', focused: true, state: 'normal' });
  updates = [];
  await toggle();
  assert.equal(updates.some(a => a.state === 'minimized'), false);
  assert.equal(activated.at(-1).id, 8);

  // Test 6: Ventana normal con pestaña única de ANFETA se trata como dedicada
  windows.get(8).tabs = [{ id: 8 }];
  updates = [];
  await toggle();
  assert.equal(windows.get(8).state, 'minimized');
  await toggle();
  assert.equal(windows.get(8).state, 'normal');

  // Test 7: Soporte para customAppUrl
  store.customAppUrl = 'http://localhost:3000';
  tabs = [];
  await toggle();
  assert.equal(lastQueryUrl, 'http://localhost:3000/*');
  delete store.customAppUrl;

  // Test 8: Reabrir si se cerró la ventana
  tabs = [];
  await toggle();
  assert.equal(created, 3);

  // Test 9: Manejo de errores sin romper la extensión
  tabs = [{ id: 99, windowId: 99 }];
  await toggle();
  assert.equal(badge, '!');
  assert.ok(store.lastError);

  tabs = [];
  await toggle();
  assert.equal(badge, '');
  assert.equal(store.lastError, undefined);

  assert.equal(typeof command, 'function');
  assert.equal(typeof action, 'function');

  console.log('OK extensión: manifiesto global, URL dinámica, abrir una vez, minimizar/restaurar, enfocar desde otra app, proteger pestañas ajenas y errores.');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
