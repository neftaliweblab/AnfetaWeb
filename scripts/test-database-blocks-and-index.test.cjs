const assert = require('assert/strict');
const fs = require('fs');
const Module = require('module');
const ts = require('typescript');

require.extensions['.ts'] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText,
    f
  );

// Mock notionCalendar for readActivityPreview
let mockBlocks = [];
const load = Module._load;
Module._load = function (n, p, ...r) {
  if (n === './notionCalendar' && p?.filename.endsWith('notionActivityPreview.ts')) {
    return {
      readBlocks: async () => structuredClone(mockBlocks)
    };
  }
  return load.call(this, n, p, ...r);
};

const { readActivityPreview } = require('../src/services/notionActivityPreview.ts');

(async () => {
  // Test 1: child_database, callout, quote
  mockBlocks = [
    {
      id: 'db-cobros',
      type: 'child_database',
      child_database: { title: 'BD COBRAR Y PAGAR (bien)' }
    },
    {
      id: 'callout-1',
      type: 'callout',
      callout: {
        rich_text: [{ plain_text: 'Instrucción importante para cobros' }],
        icon: { emoji: '💡' },
        color: 'gray_background'
      }
    },
    {
      id: 'quote-1',
      type: 'quote',
      quote: {
        rich_text: [{ plain_text: 'Referencia de factura #1234' }]
      }
    }
  ];

  const blocks = await readActivityPreview('mock-token', 'page-123');

  const dbBlock = blocks.find((b) => b.kind === 'child_database');
  assert.ok(dbBlock, 'child_database block must be present');
  assert.equal(dbBlock.text, 'BD COBRAR Y PAGAR (bien)');
  assert.equal(dbBlock.id, 'db-cobros');
  assert.ok(dbBlock.notionUrl.includes('dbcobros'));

  const calloutBlock = blocks.find((b) => b.kind === 'callout');
  assert.ok(calloutBlock, 'callout block must be present');
  assert.equal(calloutBlock.icon, '💡');
  assert.equal(calloutBlock.text, 'Instrucción importante para cobros');

  const quoteBlock = blocks.find((b) => b.kind === 'quote');
  assert.ok(quoteBlock, 'quote block must be present');
  assert.equal(quoteBlock.text, 'Referencia de factura #1234');

  // Ensure NO warning was emitted for child_database
  const warningBlock = blocks.find((b) => b.kind === 'warning');
  if (warningBlock) {
    assert.ok(
      !warningBlock.text.includes('child_database'),
      'child_database should not produce unsupported warning'
    );
  }

  // Test 2: Index slice retry and error preservation message
  const { readIndexSlice } = require('../src/services/notionSnapshotCache.ts');
  let calls = 0;
  const mockClient = {
    rpc: () => {
      calls++;
      if (calls < 3) {
        return { abortSignal: () => Promise.resolve({ error: { message: 'Timeout' } }) };
      }
      return {
        abortSignal: () => Promise.resolve({ data: { items: [{ id: '1' }], nextOffset: null } })
      };
    }
  };

  const slice = await readIndexSlice(
    { client: mockClient, userId: 'u1', source: 's1', key: 'search-index' },
    0,
    100
  );
  assert.equal(calls, 3, 'readIndexSlice should retry on transient failure');
  assert.equal(slice.items.length, 1);

  console.log('OK Database blocks preview and index loading resilience tests passed successfully.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
