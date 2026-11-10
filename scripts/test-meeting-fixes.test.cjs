const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const Module = require('module');
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

console.log('=== TEST SUITE: Meeting Nov 9 Fixes in ANFETA Web ===\n');

// 1. Template Catalog: Categoría Diseño
console.log('--- TEST 1: Template Catalog - Categoría Diseño ---');
const { CALENDAR_QUICK_TEMPLATES, filterTemplatesByCategory } = require('../src/lib/templateCatalog.ts');
const designCat = CALENDAR_QUICK_TEMPLATES.find((c) => c.key === 'diseno');
assert.ok(designCat, 'Debe existir la categoría Diseño en CALENDAR_QUICK_TEMPLATES');
assert.equal(designCat.projectToken, 'ddise');

const mockTemplates = [
  { Title: 'aaprtuzR | 💻 ccata| 📅 11.r.01.00 Pasos Productos catalogo y diseño aa-c11' },
  { Title: 'aaprtuzR | 💻 wwebs | 📅 11.w.00.70 Diseño Grafico ddise' },
  { Title: 'aaprtuzR | 💻 sseo | 📅 11.s.00.10 SEO Configuracion Basica' },
];
const filteredDesign = filterTemplatesByCategory(mockTemplates, designCat);
assert.equal(filteredDesign.length, 2, 'Debe encontrar las 2 plantillas de diseño y catálogo');
console.log('OK: Categoría Diseño agregada y filtra correctamente (encontró ' + filteredDesign.length + ' plantillas).');

// 2. ftfDashboard: completedActivities expuestas en cada colaborador
console.log('\n--- TEST 2: ftfDashboard - completedActivities expuestas ---');
const { buildFtfDashboard } = require('../src/services/ftfDashboard.ts');
const mockActivities = [
  {
    pageId: 'act-1',
    title: 'prtuzR | 💻 wwebs | 📅 11.w.01.00 Sitio web',
    person: 'Andrade',
    start: '2026-11-09T10:00:00-06:00',
    end: '2026-11-09T12:00:00-06:00',
    ftfAvailable: true,
    ftfVerified: true,
  },
  {
    pageId: 'act-2',
    title: 'prtuzR | 💻 wwebs | 📅 11.w.02.00 Sitio web 2',
    person: 'Andrade',
    start: '2026-11-09T12:00:00-06:00',
    end: '2026-11-09T14:00:00-06:00',
    ftfAvailable: true,
    ftfVerified: false,
  },
];
const dashboard = buildFtfDashboard('John', '2026-11-09', [{ name: 'Andrade' }], mockActivities, {});
const andrade = dashboard.people.find((p) => p.name === 'Andrade');
assert.ok(andrade, 'Debe encontrar a Andrade en el dashboard');
assert.equal(andrade.pending.length, 1, 'Debe tener 1 pendiente');
assert.ok(Array.isArray(andrade.completedActivities), 'Debe incluir completedActivities');
assert.equal(andrade.completedActivities.length, 1, 'Debe tener 1 completada');
assert.equal(andrade.completedActivities[0].pageId, 'act-1');
console.log('OK: completedActivities expuestas para visualizar tareas terminadas en la Bitácora.');

// 3. Verificación de archivos fuente de UI
console.log('\n--- TEST 3: UI Components verification ---');
const modalCode = fs.readFileSync(path.join(root, 'src/components/CalendarHost/UnifiedActivityModal.tsx'), 'utf8');
assert.ok(modalCode.includes('title="Cerrar ventana (Esc)"'), 'El modal unificado debe tener botón de cierre en el footer');
assert.ok(modalCode.includes('Math.max(12, Math.min(maxY, y))'), 'El modal unificado debe clamplear Y arriba a 12px mínimo');
console.log('OK: UnifiedActivityModal tiene botón inferior accesible y clamping superior.');

const cardCode = fs.readFileSync(path.join(root, 'src/components/CalendarHost/ActivityCard.tsx'), 'utf8');
assert.ok(cardCode.includes('opacity-45 hover:opacity-95'), 'ActivityCard debe atenuar actividades terminadas');
assert.ok(cardCode.includes('line-through decoration-slate-400/60'), 'ActivityCard debe tachar título de terminadas');
console.log('OK: ActivityCard tiene contraste oscuro atenuado y título suavizado para terminadas.');

const notifCode = fs.readFileSync(path.join(root, 'src/components/CalendarHost/CalendarReviewNotifications.tsx'), 'utf8');
assert.ok(notifCode.includes('normalizePerson(item.authorName||\'\')!==normalizePerson(currentUser)'), 'CalendarReviewNotifications no debe auto-notificar al autor de la observación');
console.log('OK: CalendarReviewNotifications previene auto-alerta a quien envía la revisión.');

const hostCode = fs.readFileSync(path.join(root, 'src/components/CalendarHost/CalendarHost.tsx'), 'utf8');
assert.ok(hostCode.includes('Zona de revisión reciente (últimas 2 hrs)'), 'CalendarHost debe renderizar franja de revisión de 2 horas');
console.log('OK: CalendarHost tiene franja visual de revisión reciente (últimas 2 horas).');

const ftfCode = fs.readFileSync(path.join(root, 'src/components/CalendarHost/CalendarFtfPanel.tsx'), 'utf8');
assert.ok(ftfCode.includes('title="Ver día anterior"'), 'CalendarFtfPanel debe tener navegación de días anteriores');
assert.ok(ftfCode.includes('title="Ver día siguiente"'), 'CalendarFtfPanel debe tener navegación de días siguientes');
assert.ok(ftfCode.includes('title="Abrir módulo de Avance Diario para ver desglose detallado"'), 'CalendarFtfPanel debe tener enlace a Avance Diario');
console.log('OK: CalendarFtfPanel tiene controles de navegación día a día y enlace a Avance Diario.');

console.log('\n=============================================');
console.log('ALL MEETING FIXES VERIFIED SUCCESSFULLY!');
console.log('=============================================');
