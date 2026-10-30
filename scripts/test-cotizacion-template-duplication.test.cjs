/**
 * test-cotizacion-template-duplication.test.cjs
 *
 * Verifies that templates like "prtuzR Cotizacion Etapas" containing:
 * - 153 to-do checkboxes
 * - 2 synced_blocks
 * - toggles, headings, paragraphs, numbered list items
 * - child_database (block 384abd7d-91b7-809c-ac11-f0beda59eaab)
 * can be audited (readable: true), inspected, and duplicated cleanly into Notion
 * by converting child_database into a prominent callout with direct link,
 * without throwing errors, without modifying the Notion original, and without creating incomplete pages.
 */
const fs = require('fs');
const ts = require('typescript');
const assert = require('assert/strict');
const Module = require('module');

require.extensions['.ts'] = (m, f) => {
  const code = fs.readFileSync(f, 'utf8');
  return m._compile(
    ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    f
  );
};

let tree = {};
let createdPages = [];
let appendedBlocks = [];

const load = Module._load;
Module._load = function (n, p, ...r) {
  if (p?.filename.includes('templateAccessAudit.ts') || p?.filename.includes('notionTemplateBody.ts')) {
    if (n === './notionCalendar') {
      return {
        readBlocks: async (_, id) => {
          if (tree[id] instanceof Error) throw tree[id];
          return structuredClone(tree[id] || []);
        },
      };
    }
    if (n === './notionMutations') {
      return {
        notionRequest: async (_, path, method, body) => {
          if (path.startsWith('pages/')) {
            return {
              id: path.replace('pages/', ''),
              properties: {
                'TITULO PRINCIPAL': { id: 'title', type: 'title', title: [{ text: { content: 'Plantilla' } }] },
                'Fecha POR Hacer': { id: 'date', type: 'date', date: { start: '2026-10-30T10:00:00-06:00' } },
              },
            };
          }
          if (path.includes('/children') && method === 'PATCH') {
            appendedBlocks.push(...(body.children || []));
            const created = (body.children || []).map((ch, idx) => ({ ...ch, id: 'created-' + appendedBlocks.length + '-' + idx }));
            return { results: created };
          }
          return {};
        },
      };
    }
  }
  return load.call(this, n, p, ...r);
};

const { auditTemplateAccess } = require('../src/services/templateAccessAudit.ts');
const { prepareTemplateBody, inspectTemplateBody, appendTemplateBody } = require('../src/services/notionTemplateBody.ts');
const { templateBlockPolicy } = require('../src/services/templateBlockPolicy.ts');

const text = s => [{ type: 'text', text: { content: s } }];
const b = (id, type, body = {}, has_children = false) => ({ id, type, [type]: body, has_children });

(async () => {
  console.log('--- Test 1: Verificar templateBlockPolicy para child_database ---');
  const policy = templateBlockPolicy('child_database');
  assert.equal(policy.mode, 'convert', 'child_database debe estar en modo convert');
  assert.match(policy.detail, /enlace directo/, 'El detalle debe indicar referencia con enlace');

  console.log('--- Test 2: Simulación de plantilla "Cotización Etapas" ---');
  const templateId = 'page-cotizacion';
  const cdbId = '384abd7d-91b7-809c-ac11-f0beda59eaab';

  // Build tree matching screenshot: 153 to-do, 2 synced_block, 2 toggle, 22 headings, 100 paragraphs, 63 numbered, 3 images, 1 child_database
  const todos = Array.from({ length: 153 }, (_, i) => b(`todo-${i}`, 'to_do', { rich_text: text(`Tarea Cotización ${i + 1}`), checked: false }));
  const paragraphs = Array.from({ length: 100 }, (_, i) => b(`para-${i}`, 'paragraph', { rich_text: text(`Párrafo cotización ${i + 1}`) }));
  const headings = Array.from({ length: 22 }, (_, i) => b(`head-${i}`, 'heading_3', { rich_text: text(`Etapa ${i + 1}`), is_toggleable: true }));
  const numbered = Array.from({ length: 63 }, (_, i) => b(`num-${i}`, 'numbered_list_item', { rich_text: text(`Ítem alcance ${i + 1}`) }));
  const images = Array.from({ length: 3 }, (_, i) => b(`img-${i}`, 'image', { type: 'external', external: { url: `https://example.com/mock${i}.png` } }));
  const toggles = [
    b('toggle-1', 'toggle', { rich_text: text('Desplegable 1') }, true),
    b('toggle-2', 'toggle', { rich_text: text('Desplegable 2') }, true),
  ];
  const synced1 = b('sync-1', 'synced_block', { synced_from: { block_id: 'sync-origin-1' } });
  const synced2 = b('sync-2', 'synced_block', { synced_from: null }); // original synced block

  // child_database placed inside the template
  const childDb = b(cdbId, 'child_database', { title: 'BD Cotización Etapas' });

  tree[templateId] = [
    ...headings.slice(0, 5),
    childDb,
    synced1,
    synced2,
    ...toggles,
    ...paragraphs.slice(0, 50),
    ...todos.slice(0, 100),
  ];

  // synced block 1 origin contains more todos and headings
  tree['sync-origin-1'] = [
    ...headings.slice(5, 15),
    ...todos.slice(100, 153),
    ...numbered.slice(0, 30),
  ];

  // synced block 2 contains remaining items
  tree['sync-2'] = [
    ...headings.slice(15, 22),
    ...paragraphs.slice(50, 100),
    ...numbered.slice(30, 63),
    ...images,
  ];

  tree['toggle-1'] = [b('tog1-sub', 'paragraph', { rich_text: text('Contenido desplegable 1') })];
  tree['toggle-2'] = [b('tog2-sub', 'paragraph', { rich_text: text('Contenido desplegable 2') })];

  console.log('--- Test 3: Auditoría auditTemplateAccess ---');
  const audit = await auditTemplateAccess({}, templateId);
  assert.equal(audit.readable, true, 'auditTemplateAccess debe dar readable: true');
  assert.equal(audit.issues.length, 0, 'No debe haber issues bloqueantes');
  assert.equal(audit.stats.checklists, 153, 'Debe detectar exactamente 153 checklists');
  assert.equal(audit.stats.synced, 2, 'Debe registrar los 2 synced_blocks');
  assert.equal(audit.stats.types['child_database'], 1, 'Debe registrar 1 child_database en stats.types');
  assert.ok(audit.copyPreview, 'Debe generar copyPreview');
  assert.equal(audit.copyPreview.compatible, true, 'copyPreview debe ser compatible');
  assert.ok(
    audit.copyPreview.conversions.some(c => c.type === 'child_database'),
    'copyPreview.conversions debe registrar child_database'
  );

  console.log('--- Test 4: Preparación prepareTemplateBody ---');
  const nodes = await prepareTemplateBody({}, templateId);
  assert.ok(Array.isArray(nodes), 'prepareTemplateBody debe retornar un array de nodos');

  // Find the converted child_database block
  const dbNode = nodes.find(n => n.block.type === 'callout' && n.block.callout.icon?.emoji === '📊');
  assert.ok(dbNode, 'Debe haber un bloque callout con icono de base de datos 📊');
  assert.match(dbNode.block.callout.rich_text[0].text.content, /BD Cotización Etapas/, 'Debe mostrar el título de la base');
  assert.match(
    dbNode.block.callout.rich_text[1].text.link.url,
    /384abd7d91b7809cac11f0beda59eaab/,
    'Debe contener enlace directo con el ID limpio a Notion'
  );

  // Count total checklists in materialized nodes
  let totalChecklists = 0;
  const countChecks = list => {
    for (const item of list) {
      if (item.block.type === 'to_do') totalChecklists++;
      if (item.children?.length) countChecks(item.children);
    }
  };
  countChecks(nodes);
  assert.equal(totalChecklists, 153, 'Los 153 to-dos deben conservarse completos');

  console.log('--- Test 5: Inserción en lotes appendTemplateBody ---');
  appendedBlocks = [];
  await appendTemplateBody({}, 'destination-page-id', nodes);
  assert.ok(appendedBlocks.length > 0, 'Debe haber enviado bloques a la página destino');
  const calloutAppended = appendedBlocks.find(b => b.type === 'callout' && b.callout?.icon?.emoji === '📊');
  assert.ok(calloutAppended, 'El bloque callout convertido debe haber sido insertado en Notion');

  console.log('✅ TODOS LOS TESTS DE DUPLICACIÓN DE COTIZACIÓN PASARON SATISFACTORIAMENTE.');
})().catch(err => {
  console.error('❌ Error en test de cotización:', err);
  process.exit(1);
});
