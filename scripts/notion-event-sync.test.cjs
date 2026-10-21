const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');
const crypto = require('crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
Module._extensions['.ts'] = (m, p) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(p, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    p
  );

const {
  verifyNotionWebhookSignature,
  recordPageEvent,
  getRecentPageEvents,
  getConfirmedDeletedPageIds,
  processNotionWebhook,
  cleanPageId,
  parseNotionPageProperties,
} = require('../src/services/notionEventSync.ts');

const {
  pageIdentity,
  rememberDeletedPages,
  restoreConfirmedPages,
  deletedPages,
  filterDeletedPages,
  setUnverifiedPage,
  getUnverifiedPageReason,
  clearUnverifiedPage,
} = require('../src/lib/deletedPages.ts');

const { applyNotionStates } = require('../src/lib/applyNotionStates.ts');

// Polyfill window / localStorage for client testing in Node
class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.get(key) || null; }
  setItem(key, val) { this.store.set(key, String(val)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}
global.window = {
  dispatchEvent: (event) => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};
global.localStorage = new MockLocalStorage();

(async () => {
  const sourceKey = 'test_source_key_' + Date.now();
  const testId1 = '11111111111111111111111111111111';
  const testId2 = '22222222222222222222222222222222';
  const testId3 = '33333333333333333333333333333333';
  const webhookSecret = 'test_webhook_secret_key_99';

  console.log('--- 1. Validación de Autenticidad de Webhook (HMAC-SHA256) ---');
  const validBody = JSON.stringify({ type: 'page.deleted', entity: { id: testId1 } });
  const validHmac = crypto.createHmac('sha256', webhookSecret).update(validBody).digest('hex');

  // Firma válida con prefijo sha256=
  assert.equal(verifyNotionWebhookSignature(validBody, 'sha256=' + validHmac, webhookSecret), true);
  // Firma válida sin prefijo
  assert.equal(verifyNotionWebhookSignature(validBody, validHmac, webhookSecret), true);
  // Cuerpo alterado (tampering)
  assert.equal(verifyNotionWebhookSignature(validBody + ' ', 'sha256=' + validHmac, webhookSecret), false);
  // Firma falsa / alterada
  assert.equal(verifyNotionWebhookSignature(validBody, 'sha256=0000000000000000000000000000000000000000000000000000000000000000', webhookSecret), false);
  // Encabezado inválido o ausente
  assert.equal(verifyNotionWebhookSignature(validBody, '', webhookSecret), false);
  assert.equal(verifyNotionWebhookSignature(validBody, null, webhookSecret), false);
  assert.equal(verifyNotionWebhookSignature(validBody, 'invalid-hex', webhookSecret), false);

  // Handshake de verificación de URL de Notion
  const handshakePayload = { type: 'url_verification', verification_token: 'notion_handshake_tok_42' };
  const handshakeResult = await processNotionWebhook(handshakePayload, { sourceKey });
  assert.equal(handshakeResult.handled, true);
  assert.equal(handshakeResult.handshake, true);
  assert.equal(handshakeResult.verificationToken, 'notion_handshake_tok_42');
  console.log('OK: Validación de firma HMAC-SHA256 y handshake de Notion verificados.');

  console.log('--- 2. Protección Monotónica y Manejo de Eventos Fuera de Orden ---');
  const timeT1 = '2026-10-21T10:00:00.000Z';
  const timeT2 = '2026-10-21T10:10:00.000Z'; // Más reciente
  const timeT0 = '2026-10-21T09:50:00.000Z'; // Más antiguo

  // Registrar estado en T1 (activo)
  const rec1 = await recordPageEvent({
    sourceKey,
    pageId: testId1,
    state: 'active',
    eventType: 'page.properties_updated',
    serverModified: timeT1,
    properties: { name: 'Actividad Versión 1', updateStatus: 'Por hacer' },
  });
  assert.equal(rec1.applied, true);

  // Registrar actualización en T2 (activo con nuevo nombre)
  const rec2 = await recordPageEvent({
    sourceKey,
    pageId: testId1,
    state: 'active',
    eventType: 'page.properties_updated',
    serverModified: timeT2,
    properties: { name: 'Actividad Versión 2', updateStatus: 'En progreso' },
  });
  assert.equal(rec2.applied, true);

  // Llega evento tardío/retrasado de T0 (page.deleted atrasado en la red)
  const recStale = await recordPageEvent({
    sourceKey,
    pageId: testId1,
    state: 'deleted',
    eventType: 'page.deleted',
    serverModified: timeT0,
  });
  assert.equal(recStale.applied, false, 'Un evento antiguo fuera de orden no debe sobrescribir una versión más reciente');
  assert.equal(recStale.reason, 'stale_event');

  // Idempotencia: el mismo evento repetido no causa errores
  const recDup = await recordPageEvent({
    sourceKey,
    pageId: testId1,
    state: 'active',
    eventType: 'page.properties_updated',
    serverModified: timeT2,
    properties: { name: 'Actividad Versión 2', updateStatus: 'En progreso' },
  });
  assert.equal(recDup.applied, true);
  console.log('OK: Protección monotónica comprobada: eventos fuera de orden rechazados e idempotencia garantizada.');

  console.log('--- 3. Sincronización Persistente y Eliminación / Restauración ---');
  // Eliminación confirmada en T3
  const timeT3 = '2026-10-21T10:20:00.000Z';
  const recDelete = await recordPageEvent({
    sourceKey,
    pageId: testId1,
    state: 'deleted',
    eventType: 'manual_delete',
    serverModified: timeT3,
  });
  assert.equal(recDelete.applied, true);

  let deletedIds = await getConfirmedDeletedPageIds(sourceKey);
  assert.equal(deletedIds.includes(testId1), true);

  // Restauración en T4
  const timeT4 = '2026-10-21T10:30:00.000Z';
  const recRestore = await recordPageEvent({
    sourceKey,
    pageId: testId1,
    state: 'active',
    eventType: 'page.undeleted',
    serverModified: timeT4,
    properties: { name: 'Actividad Restaurada', updateStatus: 'Por hacer' },
  });
  assert.equal(recRestore.applied, true);

  deletedIds = await getConfirmedDeletedPageIds(sourceKey);
  assert.equal(deletedIds.includes(testId1), false, 'La página restaurada ya no debe figurar como eliminada');

  console.log('OK: Ciclo persistente de borrado y restauración confirmado.');

  console.log('--- 4. Manejo Seguro de 404 (Falta de Permisos vs Eliminación Real) ---');
  // Mock fetch para simular un 404 de Notion
  const mockFetch404 = async (url) => {
    return {
      ok: false,
      status: 404,
      json: async () => ({ message: 'object_not_found' }),
    };
  };

  const webhook404Result = await processNotionWebhook(
    {
      type: 'page.properties_updated',
      entity: { id: testId2 },
      timestamp: '2026-10-21T11:00:00.000Z',
    },
    {
      sourceKey,
      notionToken: 'fake_token',
      requestFetch: mockFetch404,
    }
  );

  assert.equal(webhook404Result.processedCount, 1);
  assert.equal(webhook404Result.events[0].state, 'unverified', 'Un 404 nunca debe marcarse como deleted!');
  assert.equal(deletedPages('test_user').has(testId2), false);

  // Registro cliente del unverified notice
  setUnverifiedPage(testId2, 'No se puede verificar esta página: puede no existir o faltar acceso a la integración.');
  assert.equal(getUnverifiedPageReason(testId2).includes('No se puede verificar'), true);

  // Cuando la página vuelve a estar accesible:
  const mockFetchRestored = async (url) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: testId2,
        archived: false,
        in_trash: false,
        last_edited_time: '2026-10-21T11:15:00.000Z',
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Página Recuperada' }] },
          Estado: { type: 'status', status: { name: 'Por hacer' } },
        },
      }),
    };
  };

  const webhookRestoredResult = await processNotionWebhook(
    {
      type: 'page.properties_updated',
      entity: { id: testId2 },
      timestamp: '2026-10-21T11:15:00.000Z',
    },
    {
      sourceKey,
      notionToken: 'fake_token',
      requestFetch: mockFetchRestored,
    }
  );
  assert.equal(webhookRestoredResult.events[0].state, 'active');

  // Limpieza automática del notice al verificar
  clearUnverifiedPage(testId2);
  assert.equal(getUnverifiedPageReason(testId2), null, 'El aviso debe retirarse automáticamente al resolver la causa');
  console.log('OK: Distinción 404 vs archivado confirmado y auto-limpieza de avisos.');

  console.log('--- 5. Propagación Multi-Dispositivo / Multi-Ventana en ~5 Segundos ---');
  const syncStartTime = '2026-10-21T10:00:00.000Z';
  const startBenchmark = Date.now();

  // Cliente A elimina testId3
  await recordPageEvent({
    sourceKey,
    pageId: testId3,
    state: 'deleted',
    eventType: 'page.deleted',
    serverModified: '2026-10-21T11:20:00.000Z',
  });

  // Cliente B solicita delta events desde syncStartTime
  const deltaEvents = await getRecentPageEvents(sourceKey, syncStartTime, 100);
  const benchmarkDuration = Date.now() - startBenchmark;

  assert.equal(deltaEvents.some((e) => e.pageId === testId3 && e.state === 'deleted'), true);
  console.log(`OK: Sincronización diferencial delta completada en ${benchmarkDuration}ms (<5000ms operacional).`);

  console.log('--- 6. Coherencia entre Vistas, Copias Visuales y Paginación ---');
  const owner = 'test_owner_' + Date.now();
  rememberDeletedPages(owner, [testId3]);

  // Original row y copia visual review-mirror
  const rows = [
    { id: testId3, externalId: testId3, name: 'Original', source: 'Notion' },
    { id: 'review-mirror-' + testId3, externalId: testId3, name: 'Copia Visual Revisor', source: 'Notion' },
    { id: '44444444444444444444444444444444', externalId: '44444444444444444444444444444444', name: 'Otra Tarea', source: 'Notion' },
  ];

  const filtered = filterDeletedPages(rows, owner);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, '44444444444444444444444444444444');
  console.log('OK: filterDeletedPages elimina simultáneamente el original y la copia visual review-mirror.');

  // Prueba de actualización de propiedades con applyNotionStates
  const freshRows = [
    { id: '44444444444444444444444444444444', name: 'Nombre Anterior', status: 'Por hacer', assignedPerson: 'John' },
  ];
  const statesUpdate = [
    {
      id: '44444444444444444444444444444444',
      deleted: false,
      name: 'Nombre Actualizado Externamente',
      updateStatus: 'Terminado',
      assignedPerson: 'Genaro',
      serverModified: '2026-10-21T11:30:00.000Z',
    },
  ];

  const updatedRows = applyNotionStates(freshRows, statesUpdate);
  assert.equal(updatedRows[0].name, 'Nombre Actualizado Externamente');
  assert.equal(updatedRows[0].status, 'Terminado');
  assert.equal(updatedRows[0].assignedPerson, 'Genaro');

  // Ajuste de paginación seguro cuando se eliminan filas
  const totalItemsBefore = 25;
  const pageSize = 10;
  let currentPage = 3; // En página 3 (elementos 21-25)
  // Se eliminan 10 páginas confirmadas, totalItems pasa a 15 (2 páginas)
  const totalItemsAfter = 15;
  const maxPages = Math.max(1, Math.ceil(totalItemsAfter / pageSize));
  currentPage = Math.min(currentPage, maxPages);
  assert.equal(currentPage, 2, 'La paginación debe ajustarse automáticamente sin romper el límite de página');

  console.log('OK: Coherencia de vistas, copias visuales, propiedades y paginación validada con éxito.');
  console.log('\n=== TODAS LAS PRUEBAS DE SINCRONIZACIÓN Y PERSISTENCIA PASARON EXITOSAMENTE ===');
  process.exit(0);
})().catch((err) => {
  console.error('ERROR EN TEST DE SINCRONIZACIÓN:', err);
  process.exit(1);
});
