const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (m, p) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(p, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      }).outputText,
      p
    );
}

const {
  cleanCalendarQuickTemplateActivityTitle,
  buildCalendarQuickTemplateFinalTitle,
  extractCalendarQuickTemplateOrder,
  extractCalendarQuickTemplateDomain,
  filterTemplatesByCategory,
  CALENDAR_QUICK_TEMPLATES,
} = require('../src/lib/templateCatalog.ts');

console.log('=== TEST SUITE: New Pipe & Emoji Template Format ===\n');

// 1. Título real mostrado en el video de Edwin:
const videoTitle = 'aaprtuzR | 💻 aads | 📅 11.a.12.00 Auditoria Rápida Ads | 🌐 #p.dominio.com.ads | 🛠️#descripcion | 🔁 #ffase00 | 👥 nn-e11 aa-n11 ee-d11 ii-s11 kk-a11 | ✅ jj-o000 gg-e000';

console.log('--- TEST 1: Clean Activity Title extraction from new format ---');
const clean = cleanCalendarQuickTemplateActivityTitle(videoTitle, 'aads');
assert.equal(clean, 'Auditoria Rápida Ads', 'El título limpio debe ser exactamente el nombre sin prefijos técnicos ni tags');
console.log('OK: cleanCalendarQuickTemplateActivityTitle ->', clean);

// 2. Extracción de orden y dominio
console.log('\n--- TEST 2: Order and Domain extraction ---');
const order = extractCalendarQuickTemplateOrder(videoTitle);
assert.equal(order, '12.00');
const domain = extractCalendarQuickTemplateDomain(videoTitle);
assert.equal(domain, 'p.dominio.com.ads');
console.log('OK: Order =', order, '| Domain =', domain);

// 3. Generación del título final con emojis y formato pipe
console.log('\n--- TEST 3: Final title generation matching Notion video format ---');
const generated = buildCalendarQuickTemplateFinalTitle({
  projectToken: 'aads',
  selectedDate: new Date('2026-11-09T12:00:00'),
  orderToken: order,
  description: clean,
  domain: 'mhad.com.mx',
  personName: 'Genaro',
  reviewerName: 'John',
  templateOriginalTitle: videoTitle,
});

console.log('Generated:', generated);
assert.ok(generated.includes('prtuzR | 💻 aads | 📅 11.a.12.00 Auditoria Rápida Ads'), 'Debe incluir prefijo de revisión, área y fecha/orden/título');
assert.ok(generated.includes('🌐 #p.mhad.com.mx.ads'), 'Debe incluir dominio con prefijo # y clasificación');
assert.ok(generated.includes('🛠️#descripcion'), 'Debe conservar campo descriptivo');
assert.ok(generated.includes('🔁 #ffase00'), 'Debe conservar fase');
assert.ok(generated.includes('👤 gge11'), 'Debe incluir emoji de responsable asignado');
assert.ok(generated.includes('👥 jo11'), 'Debe incluir emoji de revisor asignado');
console.log('OK: Generated title matches video specifications 100%.');

// 4. Verificación de limpieza en plantillas con tokens legacy (ej. wwebs ttuto ccach...)
console.log('\n--- TEST 4: Cleaning residual technical tokens in web templates ---');
const webTitle = 'aaprtuzR | 💻 wwebs | 📅 11.w.06.00 wwebs ttuto ccach aactu ssiti hhost Sitio web no refleja los cambios realizados | 🌐 #p.dominio.com.webs | 🛠️#descripcion | 🔁 #ffase00 | 👥 nn-e11 aa-n11 ee-d11 ii-s11 kk-a11 | ✅ jj-o000 gg-e000';
const cleanWeb = cleanCalendarQuickTemplateActivityTitle(webTitle, 'wwebs');
assert.equal(cleanWeb, 'Sitio web no refleja los cambios realizados', 'Debe limpiar todos los prefijos viejos');
console.log('OK: cleanWeb ->', cleanWeb);

// 5. Compatibilidad hacia atrás con títulos antiguos sin pipes
console.log('\n--- TEST 5: Backward compatibility with legacy unstructured templates ---');
const legacyTitle = 'prtuzR aads 26-[08AGO] 8.00 Saldo en Cuenta Google Ads [p.dominio.com.ads] nn-e11 k-ka11';
const cleanLegacy = cleanCalendarQuickTemplateActivityTitle(legacyTitle, 'aads');
assert.equal(cleanLegacy, 'Saldo en Cuenta Google Ads');
const generatedLegacy = buildCalendarQuickTemplateFinalTitle({
  projectToken: 'aads',
  selectedDate: new Date('2026-11-09T12:00:00'),
  orderToken: '8.00',
  description: cleanLegacy,
  domain: 'cliente.com',
  personName: 'Neftali',
  templateOriginalTitle: legacyTitle,
});
assert.ok(generatedLegacy.includes('prtuzR aads 26-[11NOV] 8.00 Saldo en Cuenta Google Ads'));
console.log('OK: Legacy templates continue to work seamlessly.');

// 6. Verificación de todo el catálogo local actualizado (data/notion_template_phase1_catalog_v2.json)
console.log('\n--- TEST 6: Verify all 86 catalog items ---');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/notion_template_phase1_catalog_v2.json'), 'utf8'));
assert.equal(catalog.Items.length, 86, 'Deben existir los 86 elementos');
let structuredCount = 0;
for (const item of catalog.Items) {
  if (item.Title.includes('|')) structuredCount++;
  const cleaned = cleanCalendarQuickTemplateActivityTitle(item.Title);
  assert.ok(cleaned.length > 0, 'Cada plantilla debe producir un título limpio válido');
}
console.log(`OK: ${structuredCount} of 86 templates are in structured format with emojis and all produce clean titles.`);

console.log('\n=============================================');
console.log('ALL NEW TEMPLATE FORMAT TESTS PASSED!');
console.log('=============================================');
