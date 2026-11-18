const fs = require('fs');
const path = require('path');
const Module = require('module');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
process.env.NOTION_TOKEN = 'TEST_ONLY';
if (process.cwd().replace(/\\/g, '/') !== root) process.chdir(root);

const ts = require(path.join(root, 'node_modules/typescript'));
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return origResolve.call(this, name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (mod, file) =>
    mod._compile(
      ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText,
      file
    );
}

const { parseVisualParts, formatAreaLabel } = require(root + '/src/lib/visualTitleParser.ts');
const { getOrderNumericRank } = require(root + '/src/lib/searchResultOrder.ts');
const { buildPersonWorkQuery, passiveReviewerTag, scanActivityTags } = require(root + '/src/services/activityTags.ts');
const { extractPersonFromWorkQuery } = require(root + '/src/lib/searchTabsStorage.ts');
const { calendarDomain, calendarDisplayTitle } = require(root + '/src/services/calendarPresentation.ts');
const { contentClassification, classifiedDomain } = require(root + '/src/lib/contentClassification.ts');
const { isBillingItem, isCobroItem, isPagoItem } = require(root + '/src/lib/activeResultsFirst.ts');
const { normalizeSearchTabConfig } = require(root + '/src/lib/searchTabConfig.ts');
const { quickRevisionTitle } = require(root + '/src/lib/quickRevisionTitle.ts');
const { workflowState, isTerminadoHoyStatus, workflowBadgePresentation } = require(root + '/src/services/activityWorkflow.ts');
const { parseChecklistBlockDate, applyChecklistDateToRuns } = require(root + '/src/lib/checklistBlockDates.ts');
const { detectMediaKind } = require(root + '/src/components/MediaViewerModal.tsx');

test('§1 + §5: Nuevo formato 1./0., áreas visibles Aplicación/Software, f41.01, orden numérico y preservación de SEO', () => {
  const realExample =
    'prtuzR | 💻 AAPLI -- | 🌐 1.anfeta.com.aplicacion | 📅 11.a.f41.01 corregir anfeta | 🛠️ [CCORR AANFE NNOTI] | 👥 nne11 kka-11 gge-11 sso-11 aac-11 eed-11 jjo11 | ✅ jjo-000';
  const parsed = parseVisualParts(realExample);
  assert.equal(parsed.monthCode, '11');
  assert.equal(parsed.orderCode, 'f41.01');
  assert.equal(parsed.domain, 'anfeta.com');
  assert.equal(formatAreaLabel(parsed.area), 'Aplicación');
  assert.equal(formatAreaLabel('SOFTWARE'), 'Software');

  assert.equal(
    getOrderNumericRank({ name: '11.a.02.00 Tarea dos' }) <
      getOrderNumericRank({ name: '11.a.10.00 Tarea diez' }),
    true
  );
  assert.equal(
    getOrderNumericRank({ name: '11.a.01.00 Tarea uno' }) <
      getOrderNumericRank({ name: '11.a.02.00 Tarea dos' }),
    true
  );

  assert.equal(contentClassification('0.anfeta.com.03 Documentación SSOFT módulo'), 'documentation');
  assert.equal(contentClassification('1.anfeta.com.aplicacion'), 'project');
  assert.equal(classifiedDomain('0.anfeta.com'), 'anfeta.com');
  assert.equal(classifiedDomain('1.anfeta.com'), 'anfeta.com');

  // Versiones / IPs / años no deben convertirse accidentalmente en orderCode o truncar dominio
  const withIp = parseVisualParts('prtuzR 192.168.1.1 v2.0.1 2026 Revisar servidor');
  assert.equal(withIp.orderCode, '');

  // SEO descriptivo real no se pierde cuando el área dice SSEO
  const withSeo = parseVisualParts('11 | SSEO | anfeta.com | SEO Optimización técnica y sitemap');
  assert.match(withSeo.title, /SEO/i);
  assert.equal(calendarDomain('0.anfeta.com.03 Tutorial'), 'anfeta.com');
  assert.doesNotMatch(
    calendarDisplayTitle('prtuzR | 🌐 1.anfeta.com.aplicacion | 📅 11.a.f41.01 corregir anfeta', 'anfeta.com'),
    /^1\./
  );
});

test('§3: Consulta personal automática genera únicamente códigos canónicos sin nombre antepuesto e incluye a Edwin', () => {
  const neftQuery = buildPersonWorkQuery('Neftali');
  assert.equal(neftQuery, 'nne00 OR nne11 OR nne22 OR nne33 OR nne000');
  assert.equal(extractPersonFromWorkQuery(neftQuery), 'Neftali');

  const edwinQuery = buildPersonWorkQuery('Edwin');
  assert.equal(edwinQuery, 'eed00 OR eed11 OR eed22 OR eed33 OR eed000');
  assert.equal(extractPersonFromWorkQuery(edwinQuery), 'Edwin');

  // Variantes vigentes con guion normalizadas correctamente sin confundir jjo-000 pasivo vs jjo000 activo
  const scan = scanActivityTags('👥 #nne-11 ✅ jjo-000');
  assert.ok(scan.some((t) => t.person === 'Neftali' && t.role === 'template'));
  assert.ok(scan.some((t) => t.person === 'John' && t.role === 'template' && t.suffix === '000'));
  const scanActiveRev = scanActivityTags('rtuzR | Revision | jjo000');
  assert.ok(scanActiveRev.some((t) => t.person === 'John' && t.role === 'review'));
});

test('§4: Exclusión predeterminada de Ingresos y Egresos en trabajo personal y recuperación en vistas financieras', () => {
  const defaults = normalizeSearchTabConfig({});
  assert.equal(defaults.billingFilter, 'exclude');
  assert.equal(defaults.paymentFilter, 'exclude');

  assert.equal(isBillingItem({ id: 'p1', name: 'Actividad normal de soporte', properties: { Fuente: 'Tareas' } }), false);
  assert.equal(isBillingItem({ id: 'p2', name: 'Llamar para cobrar cliente', properties: { Fuente: 'Tareas' } }), false);
  const cobro = { id: 'p3', name: 'zcobrar Factura mensual', properties: { Fuente: 'Cobrar y pagar', Tipo: 'Ingreso' } };
  const pago = { id: 'p4', name: 'zpagar Servidor VPS', properties: { Fuente: 'Cobrar y pagar', Tipo: 'Egreso' } };
  assert.equal(isCobroItem(cobro), true);
  assert.equal(isPagoItem(pago), true);
  assert.equal(isBillingItem(cobro), true);
  assert.equal(isBillingItem(pago), true);
});

test('§6: Asignación rápida usa 1. y revisor pasivo jjo-000', () => {
  const built = quickRevisionTitle({
    type: 'AAPLI',
    title: 'Revisión urgente',
    person: 'Neftali',
    domain: 'anfeta.com',
    reviewer: 'John',
    month: '11',
  });
  assert.match(built, /#1\.anfeta\.com/);
  assert.match(built, /jjo-000/);
  assert.doesNotMatch(built, /jjo000/);
  assert.equal(passiveReviewerTag('John'), 'jjo-000');
});

test('§9: PPRTUZ TERMINADO-HOY-(POR HACER) conserva flujo activo sin finalizar definitivamente', () => {
  assert.equal(isTerminadoHoyStatus('PPRTUZ TERMINADO-HOY-(POR HACER)'), true);
  assert.equal(workflowState('PPRTUZ TERMINADO-HOY-(POR HACER)', ''), 'pending');
  const badge = workflowBadgePresentation('PPRTUZ TERMINADO-HOY-(POR HACER)', '');
  assert.equal(badge.shortLabel, 'HOY✓');
  assert.equal(badge.isCompletedToday, true);
});

test('§10: Parser/serializer de fecha [YYYY-MM-DD] en bloques to_do de Notion conserva links y texto', () => {
  const parsed = parseChecklistBlockDate('Revisar endpoint [2026-11-18]');
  assert.equal(parsed.plannedDate, '2026-11-18');
  assert.equal(parsed.cleanText, 'Revisar endpoint');

  const runs = [
    { type: 'text', text: { content: 'Abrir ', link: null }, annotations: { bold: true } },
    { type: 'text', text: { content: 'docs [2026-11-17]', link: { url: 'https://anfeta.com' } }, annotations: {} },
  ];
  const updated = applyChecklistDateToRuns(runs, '2026-11-19');
  assert.equal(updated[1].text.link.url, 'https://anfeta.com');
  assert.match(updated.map((r) => r.text.content).join(''), /\[2026-11-19\]$/);
  const cleared = applyChecklistDateToRuns(updated, null);
  assert.doesNotMatch(cleared.map((r) => r.text.content).join(''), /\[\d{4}-\d{2}-\d{2}\]/);
});

test('§13: detectMediaKind distingue audio .ogg vs video .mp4/.mkv/.mov', () => {
  assert.equal(detectMediaKind('https://cdn.notion.so/nota-voz.ogg?X-Amz=1'), 'audio');
  assert.equal(detectMediaKind('https://cdn.notion.so/grabacion.mkv?X-Amz=1'), 'video');
  assert.equal(detectMediaKind('https://cdn.notion.so/clip.mov'), 'video');
});
