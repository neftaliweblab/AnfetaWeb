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

const { normalizeSearchRow } = require('../src/services/dataNormalizers.ts');
const { filterByNotionBase, isContentItem } = require('../src/lib/notionFilters.ts');
const { matchesFlexibleOrQuotedQuery } = require('../src/services/advancedQuery.ts');

console.log('=== TEST SUITE: ANFETA "Contenido" Search Scope & Content Filtering ===\n');

// 1. Verificación de normalización de filas: contentSnippet NO debe heredar SearchText
console.log('--- TEST 1: dataNormalizers contentSnippet isolation ---');
const rawNotionPageWithoutContent = {
  Name: '[Revisiones] tuzR Cotizacion Etapas [ .com.cotizacion] iis11',
  SearchText: 'Revisiones tuzR Cotizacion Etapas [ .com.cotizacion] iis11 Por hacer 2026-10-30',
  Description: '',
  Source: 2,
  ExternalSourceName: 'Revisiones',
  Target: 'https://notion.so/cotizacion123',
};

const norm1 = normalizeSearchRow(rawNotionPageWithoutContent, 1);
assert.equal(norm1.contentSnippet, '', 'contentSnippet no debe contener SearchText');
assert.equal(norm1.description, '', 'description debe ser vacía');

const rawNotionPageWithContent = {
  Name: '[Revisiones] tuzR Auditoría Técnica jjo11',
  SearchText: 'Revisiones tuzR Auditoría Técnica jjo11 Por hacer 2026-10-30',
  Description: 'Detalle de la auditoría: revisar enlaces rotos y formulario de cotización en WordPress.',
  Source: 2,
  ExternalSourceName: 'Revisiones',
  Target: 'https://notion.so/auditoria123',
};

const norm2 = normalizeSearchRow(rawNotionPageWithContent, 2);
assert.equal(norm2.description, 'Detalle de la auditoría: revisar enlaces rotos y formulario de cotización en WordPress.');
assert.equal(norm2.contentSnippet, 'Detalle de la auditoría: revisar enlaces rotos y formulario de cotización en WordPress.');
console.log('OK: contentSnippet isolated from SearchText title metadata.');

// 2. Verificación de isContentItem
console.log('\n--- TEST 2: isContentItem identification ---');
const fileDoc = {
  id: 'doc-1',
  name: 'Brief_Cotizacion_2026.pdf',
  extension: 'pdf',
  source: 'Dropbox',
  sourceName: 'Dropbox',
  isFolder: false,
  type: 'FILE',
};
const fileFolder = {
  id: 'folder-1',
  name: 'Cotizaciones',
  source: 'Dropbox',
  sourceName: 'Dropbox',
  isFolder: true,
  type: 'FOLDER',
};

assert.equal(isContentItem(norm1), false, 'Página sin contenido no debe ser ContentItem');
assert.equal(isContentItem(norm2), true, 'Página con Description debe ser ContentItem');
assert.equal(isContentItem(fileDoc), false, 'La extensión no demuestra que el texto esté indexado');
assert.equal(isContentItem(fileFolder), false, 'Carpeta no debe ser ContentItem');
console.log('OK: isContentItem correctly separates items with body content/docs from title-only pages.');

// 3. Verificación de filterByNotionBase con "Contenido"
console.log('\n--- TEST 3: filterByNotionBase with Contenido scope ---');
const items = [norm1, norm2, fileDoc, fileFolder];
const contenidoResults = filterByNotionBase(items, 'Contenido');
assert.equal(contenidoResults.length, 1, 'Solo debe aparecer la página con texto indexado');
assert.deepEqual(contenidoResults.map(x => x.id), [norm2.id]);
console.log('OK: filterByNotionBase("Contenido") excludes title-only Notion pages.');

// 4. Verificación de búsqueda contentOnly vs normal
console.log('\n--- TEST 4: Query matching contentOnly vs Title ---');
// Buscamos "formulario"
// norm1: Título "Cotizacion Etapas", sin contenido -> No tiene "formulario"
// norm2: Título "Auditoría Técnica", pero su Description tiene "formulario de cotización"

// A) Búsqueda normal (Title/Metadata): "formulario"
assert.equal(matchesFlexibleOrQuotedQuery(norm1, 'formulario'), false);
assert.equal(matchesFlexibleOrQuotedQuery(norm2, 'formulario'), true);

// B) Buscamos "auditoria"
// En normal: norm2 coincide por título
assert.equal(matchesFlexibleOrQuotedQuery(norm2, 'auditoria'), true);
// En contentOnly: norm2 tiene "auditoría" en la description -> coincide
assert.equal(matchesFlexibleOrQuotedQuery(norm2, 'auditoria', { contentOnly: true }), true);

// C) Buscamos "jjo11" (tag en el título de norm2)
// En normal: norm2 coincide porque jjo11 es tag de responsable
assert.equal(matchesFlexibleOrQuotedQuery(norm2, 'jjo11'), true);
// En contentOnly: "jjo11" NO está en la descripción -> NO DEBE COINCIDIR en búsqueda de contenido
assert.equal(matchesFlexibleOrQuotedQuery(norm2, 'jjo11', { contentOnly: true }), false);
console.log('OK: contentOnly strictly matches within internal text and excludes title tags.');

// D) norm1 tiene "Cotizacion" en el título pero NINGÚN contenido
assert.equal(matchesFlexibleOrQuotedQuery(norm1, 'cotizacion'), true, 'norm1 coincide en búsqueda normal por título');
assert.equal(matchesFlexibleOrQuotedQuery(norm1, 'cotizacion', { contentOnly: true }), false, 'norm1 NO coincide en búsqueda de contenido porque carece de cuerpo interno');
console.log('OK: Title-only matches are blocked when contentOnly is active.');

// 5. Verificación de dinamismo con anfeta_page_content_loaded
console.log('\n--- TEST 5: Dynamic pageContent enrichment ---');
const enrichedPage = {
  ...norm1,
  pageContent: 'Bloque 1: Presupuesto acordado.\nBloque 2: Requiere anticipo 50%.',
  contentSnippet: 'Presupuesto acordado. Requiere anticipo 50%.',
};
assert.equal(isContentItem(enrichedPage), true, 'Una página enriquecida dinámicamente pasa a ser ContentItem');
assert.equal(matchesFlexibleOrQuotedQuery(enrichedPage, 'anticipo', { contentOnly: true }), true);
assert.equal(matchesFlexibleOrQuotedQuery(enrichedPage, 'desconocido', { contentOnly: true }), false);
console.log('OK: Dynamically loaded page content is immediately searchable in Contenido scope.');

console.log('\n=============================================');
console.log('ALL CONTENIDO SCOPE TESTS PASSED!');
console.log('=============================================');

const {hasIndexedContentMatch}=require('../src/services/advancedQuery.ts');
const {isLegacyDropboxDiskItem}=require('../src/lib/notionFilters.ts');
const cloud={...fileDoc,name:'acceso.txt',path:'/Proyectos/acceso.txt'};
const disk={...cloud,path:'C:/Users/nanoc/Dropbox/Proyectos/acceso.txt',contentSnippet:'acceso confirmado'};
assert.equal(matchesFlexibleOrQuotedQuery(cloud,'acceso',{contentOnly:true}),false);
assert.equal(matchesFlexibleOrQuotedQuery(cloud,'acceso',{contentOnly:true,matchRegex:true}),false);
assert.equal(isLegacyDropboxDiskItem(disk),true);
assert.equal(isContentItem(disk),false);
assert.equal(isLegacyDropboxDiskItem(cloud),false);
assert.equal(isContentItem({...cloud,contentSnippet:'acceso confirmado'}),true);
assert.equal(hasIndexedContentMatch(enrichedPage,'anticipo'),true);
assert.equal(hasIndexedContentMatch(cloud,'acceso'),false);
assert.equal(hasIndexedContentMatch(enrichedPage,'source:notion'),false);
console.log('OK rutas de Dropbox, consultas regex y evidencia del badge.');

// 6. Verificación del campo de Notion IA: "busqueda palabras por contenido pagina IA"
console.log('\n--- TEST 6: Notion AI Property "busqueda palabras por contenido pagina IA" ---');
const rawNotionWithAiField = {
  Name: '[Revisiones] tuzR Campaña Google Ads',
  'busqueda palabras por contenido pagina IA': 'Estrategia de palabras clave de alto rendimiento para landing de fontanería',
  Source: 2,
  ExternalSourceName: 'Revisiones',
  Target: 'https://notion.so/ads123',
};
const normAi = normalizeSearchRow(rawNotionWithAiField, 3);
assert.equal(normAi.aiContent, 'Estrategia de palabras clave de alto rendimiento para landing de fontanería');
assert.equal(normAi['busqueda palabras por contenido pagina IA'], 'Estrategia de palabras clave de alto rendimiento para landing de fontanería');
assert.equal(isContentItem(normAi), true, 'Debe ser reconocido como ContentItem por el campo de IA');
assert.equal(matchesFlexibleOrQuotedQuery(normAi, 'fontaneria', { contentOnly: true }), true, 'Búsqueda por contenido debe encontrar palabras en el campo de IA');
assert.equal(matchesFlexibleOrQuotedQuery(normAi, 'fontanería', { contentOnly: true }), true, 'Búsqueda con acentos debe coincidir');
assert.equal(matchesFlexibleOrQuotedQuery(normAi, 'rendimiento', { contentOnly: true }), true);
assert.equal(matchesFlexibleOrQuotedQuery(normAi, 'palabras clave'), true);

const rawNotionWithAccentedAiField = {
  Name: '[Revisiones] tuzR Optimización SEO',
  'búsqueda palabras por contenido página IA': 'Análisis semántico e indexación profunda con Inteligencia Artificial',
  Source: 2,
};
const normAccentedAi = normalizeSearchRow(rawNotionWithAccentedAiField, 4);
assert.equal(normAccentedAi.aiContent, 'Análisis semántico e indexación profunda con Inteligencia Artificial');
assert.equal(matchesFlexibleOrQuotedQuery(normAccentedAi, 'semantico', { contentOnly: true }), true);
console.log('OK: Notion AI field "busqueda palabras por contenido pagina IA" correctly indexed and searchable in Contenido scope.');

// 7. Verificación del caso real de usuario: "bitacora" sin acento buscando en propiedad IA con "bitácora"
console.log('\n--- TEST 7: Real User Case: "bitacora" in Notion AI Property ---');
const userPage = {
  Name: '[Revisiones] prtuzR | 💻 aapli | 📅 11.a.00.00 Asistente recurrente | 🛠️ ccrea bbita',
  'busqueda palabras por contenido pagina IA': 'bitácora, FTF, conexión, horario, métricas, semana, rendimiento, IA, búsqueda, contenido, panel, pendientes, optimización, rendimiento, orden, validación, palabras, buscador.',
  Source: 2,
  ExternalSourceName: 'Revisiones',
  Target: 'https://notion.so/db1abd7d91b782fcb22681b96154a310',
};
const normUserPage = normalizeSearchRow(userPage, 5);
assert.equal(isContentItem(normUserPage), true);
assert.equal(matchesFlexibleOrQuotedQuery(normUserPage, 'bitacora', { contentOnly: true }), true, 'Búsqueda sin acento "bitacora" debe coincidir con "bitácora"');
assert.equal(matchesFlexibleOrQuotedQuery(normUserPage, 'bitácora', { contentOnly: true }), true, 'Búsqueda con acento "bitácora" debe coincidir');
assert.equal(matchesFlexibleOrQuotedQuery(normUserPage, '"bitacora"', { contentOnly: true }), true, 'Búsqueda exacta con comillas "bitacora" debe coincidir');
assert.equal(matchesFlexibleOrQuotedQuery(normUserPage, 'conexion', { contentOnly: true }), true);
assert.equal(matchesFlexibleOrQuotedQuery(normUserPage, 'busqueda', { contentOnly: true }), true);
assert.equal(matchesFlexibleOrQuotedQuery(normUserPage, 'optimizacion', { contentOnly: true }), true);
console.log('OK: User real case with bitacora / bitácora perfectly matches in Contenido scope.');

// 8. Verificación de retainSearchResults: fusión de propiedades IA en caché
console.log('\n--- TEST 8: retainSearchResults merges new AI property into old cached rows ---');
const { retainSearchResults } = require('../src/lib/retainSearchResults.ts');
const cachedStaleRow = {
  id: 'notion:db1abd7d91b782fcb22681b96154a310',
  externalId: 'db1abd7d91b782fcb22681b96154a310',
  name: '[Revisiones] prtuzR 11.a.00.00',
  source: 'Notion',
  serverModified: '2026-11-06T17:46:00.000Z',
  // Sin aiContent
};
const incomingEnrichedRow = {
  id: 'notion:db1abd7d91b782fcb22681b96154a310',
  externalId: 'db1abd7d91b782fcb22681b96154a310',
  name: '[Revisiones] prtuzR 11.a.00.00',
  source: 'Notion',
  serverModified: '2026-11-06T17:46:00.000Z',
  aiContent: 'bitácora, FTF, conexión',
  'busqueda palabras por contenido pagina IA': 'bitácora, FTF, conexión',
};
const merged = retainSearchResults([cachedStaleRow], { items: [incomingEnrichedRow] });
assert.equal(merged[0].aiContent, 'bitácora, FTF, conexión', 'Debe enriquecer la fila vieja con aiContent');
assert.equal(merged[0]['busqueda palabras por contenido pagina IA'], 'bitácora, FTF, conexión');
assert.equal(isContentItem(merged[0]), true);
assert.equal(matchesFlexibleOrQuotedQuery(merged[0], 'bitacora', { contentOnly: true }), true);
console.log('OK: retainSearchResults seamlessly merges AI content without dropping it.');

// 9. Verificación de directActivitySearchRow
console.log('\n--- TEST 9: directActivitySearchRow carries AI content ---');
const { directActivitySearchRow } = require('../src/lib/activityDeepLink.ts');
const directAct = {
  pageId: 'db1abd7d91b782fcb22681b96154a310',
  pageUrl: 'https://notion.so/db1abd7d91b782fcb22681b96154a310',
  title: 'prtuzR 11.a.00.00',
  person: 'Neftali',
  status: 'prtuzREVISION',
  start: '2026-11-06T10:00:00.000-06:00',
  end: '2026-11-06T12:00:00.000-06:00',
  domain: 'd.anfeta.com.aplicacion.web',
  aiContent: 'bitácora, FTF, conexión',
};
const directSearchRow = directActivitySearchRow(directAct);
assert.equal(directSearchRow.aiContent, 'bitácora, FTF, conexión');
assert.equal(isContentItem(directSearchRow), true);
assert.equal(matchesFlexibleOrQuotedQuery(directSearchRow, 'bitacora', { contentOnly: true }), true);
console.log('OK: directActivitySearchRow preserves AI content.');


