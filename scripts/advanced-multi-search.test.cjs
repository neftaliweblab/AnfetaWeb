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
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    p
  );
Module._extensions['.tsx'] = (m, p) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(p, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    }).outputText,
    p
  );

const { matchesFlexibleOrQuotedQuery } = require(path.join(root, 'src/services/advancedQuery.ts'));
const { extractSearchTerms, getSearchTermColorMap, MULTI_SEARCH_PALETTE } = require(path.join(
  root,
  'src/lib/multiSearchHighlight.tsx'
));

console.log('--- Corriendo pruebas de Búsqueda Avanzada y Múltiple ---');

// Mock rows
const itemBoth = {
  id: 'item-1',
  name: 'Actividad jjo00 con referencia jjo1',
  path: 'Notion/Revisiones',
  source: 'Notion',
};

const itemOnlyTerm1 = {
  id: 'item-2',
  name: 'Actividad jjo00 únicamente',
  path: 'Notion/Revisiones',
  source: 'Notion',
};

const itemOnlyTerm2 = {
  id: 'item-3',
  name: 'Actividad jjo1 únicamente',
  path: 'Notion/Revisiones',
  source: 'Notion',
};

const itemNeither = {
  id: 'item-4',
  name: 'Actividad sin ninguno de los dos',
  path: 'Notion/Revisiones',
  source: 'Notion',
};

// 1. Prueba de operador AND (minúscula y mayúscula)
assert.equal(
  matchesFlexibleOrQuotedQuery(itemBoth, 'jjo00 and jjo1'),
  true,
  'jjo00 and jjo1 debe coincidir cuando ambos términos están presentes'
);
assert.equal(
  matchesFlexibleOrQuotedQuery(itemOnlyTerm1, 'jjo00 and jjo1'),
  false,
  'jjo00 and jjo1 NO debe coincidir si solo está el primer término'
);
assert.equal(
  matchesFlexibleOrQuotedQuery(itemOnlyTerm2, 'jjo00 and jjo1'),
  false,
  'jjo00 and jjo1 NO debe coincidir si solo está el segundo término'
);
assert.equal(
  matchesFlexibleOrQuotedQuery(itemBoth, 'jjo00 AND jjo1'),
  true,
  'jjo00 AND jjo1 (mayúscula) debe coincidir cuando ambos términos están presentes'
);
assert.equal(
  matchesFlexibleOrQuotedQuery(itemOnlyTerm1, 'jjo00 AND jjo1'),
  false,
  'jjo00 AND jjo1 (mayúscula) NO debe coincidir si falta un término'
);

// 2. Prueba de operador OR (minúscula y mayúscula)
assert.equal(
  matchesFlexibleOrQuotedQuery(itemBoth, 'jjo00 or jjo1'),
  true,
  'jjo00 or jjo1 debe coincidir si están ambos'
);
assert.equal(
  matchesFlexibleOrQuotedQuery(itemOnlyTerm1, 'jjo00 or jjo1'),
  true,
  'jjo00 or jjo1 debe coincidir si está solo el primer término'
);
assert.equal(
  matchesFlexibleOrQuotedQuery(itemOnlyTerm2, 'jjo00 or jjo1'),
  true,
  'jjo00 or jjo1 debe coincidir si está solo el segundo término'
);
assert.equal(
  matchesFlexibleOrQuotedQuery(itemNeither, 'jjo00 or jjo1'),
  false,
  'jjo00 or jjo1 NO debe coincidir si no está ninguno'
);
assert.equal(
  matchesFlexibleOrQuotedQuery(itemOnlyTerm1, 'jjo00 OR jjo1'),
  true,
  'jjo00 OR jjo1 (mayúscula) debe coincidir con el primer término'
);

// 3. Prueba de operador NOT
assert.equal(
  matchesFlexibleOrQuotedQuery(itemOnlyTerm1, 'jjo00 not jjo1'),
  true,
  'jjo00 not jjo1 debe coincidir si tiene jjo00 y NO tiene jjo1'
);
assert.equal(
  matchesFlexibleOrQuotedQuery(itemBoth, 'jjo00 not jjo1'),
  false,
  'jjo00 not jjo1 NO debe coincidir si tiene jjo1'
);

// 4. Prueba de consultas normales de varias palabras (AND por espacio)
const itemFactura = {
  id: 'fact-1',
  name: 'Factura 2026 de cliente acalli',
  path: 'Dropbox/Facturas',
  source: 'Dropbox',
};
assert.equal(
  matchesFlexibleOrQuotedQuery(itemFactura, 'factura 2026'),
  true,
  'factura 2026 por espacio debe requerir ambos términos'
);
assert.equal(
  matchesFlexibleOrQuotedQuery(itemOnlyTerm1, 'factura 2026'),
  false,
  'factura 2026 debe rechazar elementos sin factura'
);

// 5. Extracción de términos para resaltado diferenciado
const terms1 = extractSearchTerms('jjo00 and jjo1');
assert.deepEqual(terms1, ['jjo00', 'jjo1'], 'extractSearchTerms debe extraer jjo00 y jjo1 ignorando and');

const terms2 = extractSearchTerms('jjo00 OR jjo1 OR cliente');
assert.deepEqual(terms2, ['jjo00', 'jjo1', 'cliente'], 'extractSearchTerms debe extraer términos ignorando OR');

const terms3 = extractSearchTerms('ext:pdf "reporte mensual" and avance -antiguo');
assert.deepEqual(terms3, ['reporte mensual', 'avance'], 'extractSearchTerms debe omitir ext:pdf y negaciones -antiguo');

// 6. Asignación de colores diferenciados en la paleta
const { termColorMap } = getSearchTermColorMap('jjo00 and jjo1');
const color1 = termColorMap.get('jjo00');
const color2 = termColorMap.get('jjo1');

assert.ok(color1, 'jjo00 debe tener asignado un color');
assert.ok(color2, 'jjo1 debe tener asignado un color');
assert.equal(color1.key, 'cyan', 'Primer término jjo00 debe ser de color Cian');
assert.equal(color1.hex, '#38BDF8', 'Cian debe tener hex #38BDF8');
assert.equal(color2.key, 'pink', 'Segundo término jjo1 debe ser de color Rosa');
assert.equal(color2.hex, '#F472B6', 'Rosa debe tener hex #F472B6');
// 7. Tolerancia a acentos y diacríticos
const { normalizeDiacritics, makeAccentRegexPattern } = require(path.join(root, 'src/lib/multiSearchHighlight.tsx'));
assert.equal(normalizeDiacritics('Diseño'), 'diseno', 'normalizeDiacritics debe remover acentos');
assert.equal(normalizeDiacritics('Camión'), 'camion', 'normalizeDiacritics debe remover tildes');

const pattern = makeAccentRegexPattern('diseno');
const accentRegex = new RegExp(pattern, 'i');
assert.equal(accentRegex.test('Diseño Web'), true, 'diseno debe coincidir con Diseño');
assert.equal(accentRegex.test('Diseno Web'), true, 'diseno debe coincidir con Diseno');

console.log('OK: Búsqueda avanzada múltiple (AND, OR, NOT), tokenización, tolerancia a acentos y paleta de colores diferenciados probados exitosamente.');
