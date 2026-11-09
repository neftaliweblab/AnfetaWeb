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
Module._extensions['.ts'] = (m, p) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(p, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    p
  );

// 1. Verificar normalización y tolerancia de acentos en búsqueda de contenido
const { extractAiContent } = require(path.join(root, 'src/services/dataNormalizers.ts'));
const { indexedContentText } = require(path.join(root, 'src/services/advancedQuery.ts'));
const { normalizeFtfPropertyName, ftfField } = require(path.join(root, 'src/services/ftfVerification.ts'));
const { isReviewer, isDirection } = require(path.join(root, 'src/services/activityPermissions.ts'));

console.log('Testing Punto 1: Búsqueda de contenido y propiedades...');
// Comprobar extracción de propiedades con y sin tilde
const rowConTilde = {
  Name: 'Actividad sin termino en titulo',
  'búsqueda palabras por contenido página IA': 'registro de bitácora diaria y revisión',
};
assert.equal(extractAiContent(rowConTilde), 'registro de bitácora diaria y revisión');

const rowSinTilde = {
  Name: 'Actividad sin termino en titulo',
  'busqueda palabras por contenido pagina ia': 'bitacora de seguimiento de sprint',
};
assert.equal(extractAiContent(rowSinTilde), 'bitacora de seguimiento de sprint');

// Comprobar que indexedContentText NO descarta el contenido del cuerpo cuando aiProp existe o no
const itemWithBody = {
  source: 'Notion',
  aiContent: 'resumen breve',
  contentSnippet: 'detalles importantes con bitácora en comentarios',
  pageContent: 'contenido completo de la página de Notion',
};
const combined = indexedContentText(itemWithBody);
assert(combined.includes('resumen breve'), 'Debe incluir aiContent');
assert(combined.includes('bitácora'), 'Debe incluir contentSnippet con bitácora');
assert(combined.includes('contenido completo'), 'Debe incluir pageContent');

// Comprobar reconocimiento de la propiedad FTF solicitada por John con emoji 🔥
assert.equal(normalizeFtfPropertyName('🔥 Check FTF Pasos Verificados Hoy'), 'check ftf pasos verificados hoy');
assert.equal(normalizeFtfPropertyName('Check FTF Pasos Verificados Hoy'), 'check ftf pasos verificados hoy');
assert.equal(normalizeFtfPropertyName('🔥 Audit FTF'), 'audit ftf');
assert.equal(normalizeFtfPropertyName('Audit FTF'), 'audit ftf');

const fakePageWithEmojiFtf = {
  properties: {
    '🔥 Check FTF Pasos Verificados Hoy': { type: 'checkbox', checkbox: true },
  },
};
const field = ftfField(fakePageWithEmojiFtf);
assert(field, 'Debe detectar la propiedad con emoji');
assert.equal(field[1].checkbox, true);

console.log('Testing Punto 2: Permisos de Reasignación Genaro -> Andrade...');
// Genaro es Revisor (isReviewer(user) === true)
assert(isReviewer('Genaro'), 'Genaro debe ser reconocido como Revisor');
assert(isReviewer('ggena'), 'El alias ggena debe ser Revisor');
assert(!isDirection('Genaro'), 'Genaro no es Dirección (Dirección es John y Neftali)');
assert(isDirection('John'), 'John es Dirección');
assert(isDirection('Neftali'), 'Neftali es Dirección');

// Un usuario común no revisor no puede reasignar actividades ajenas
assert(!isReviewer('Acalli'), 'Acalli es colaboradora, no revisora');
assert(!isReviewer('Andrade'), 'Andrade es colaborador, no revisor');

console.log('Testing Punto 6: Anchos de columnas y alineación de tabla...');
// Verificar que el header actions tiene el mismo ancho (110px) que las filas
const tableFile = fs.readFileSync(path.join(root, 'src/components/ResultsViewHost/ResultsVirtualTable.tsx'), 'utf8');
assert(tableFile.includes('w-[110px] shrink-0 flex items-center justify-end'), 'El encabezado de acciones debe tener w-[110px] igual que las filas');
assert(!tableFile.includes('w-[62px] shrink-0 text-center flex items-center justify-center'), 'No debe quedar el encabezado desalineado w-[62px]');

console.log('Testing Punto 5: Plan B y enlaces de Notion...');
const { PERSON_METADATA } = require(path.join(root, 'src/services/identityNormalizer.ts'));
const validNotionUrls = Object.entries(PERSON_METADATA).filter(([_, m]) => m.notionUrl);
assert(validNotionUrls.length >= 7, 'Debe haber enlaces de calendario de Notion verificados para los integrantes');
assert(PERSON_METADATA.John.notionUrl.includes('notion.com'), 'John debe tener notionUrl válido');
assert(PERSON_METADATA.Andrade.notionUrl.includes('notion.com'), 'Andrade debe tener notionUrl válido');
assert(PERSON_METADATA.Genaro.notionUrl.includes('notion.com'), 'Genaro debe tener notionUrl válido');

console.log('ALL TESTS PASSED! Verification completed successfully.');
