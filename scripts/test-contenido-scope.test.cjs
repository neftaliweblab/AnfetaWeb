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
assert.equal(isContentItem(fileDoc), true, 'Archivo de texto/documento debe ser ContentItem');
assert.equal(isContentItem(fileFolder), false, 'Carpeta no debe ser ContentItem');
console.log('OK: isContentItem correctly separates items with body content/docs from title-only pages.');

// 3. Verificación de filterByNotionBase con "Contenido"
console.log('\n--- TEST 3: filterByNotionBase with Contenido scope ---');
const items = [norm1, norm2, fileDoc, fileFolder];
const contenidoResults = filterByNotionBase(items, 'Contenido');
assert.equal(contenidoResults.length, 2, 'Solo deben coincidir norm2 (con description) y fileDoc (documento)');
assert.deepEqual(contenidoResults.map(x => x.id), [norm2.id, fileDoc.id]);
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
