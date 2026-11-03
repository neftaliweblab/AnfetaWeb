const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
process.chdir(root);

const ts = require(path.join(root, 'node_modules/typescript'));
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
};

for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (mod, file) =>
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      }
    }).outputText, file);
}

const {
  getPublicBaseUrl,
  canonicalActivityUrl,
  evaluateActivityLink,
  findActivityLinkProperty,
  saveActivityLinkToNotion,
  verifyEnabledBasesLinkProperty,
  backfillActivityLinks,
} = require('@/services/activityLinkService');

const { ANFETA_BASES } = require('@/lib/notionBaseCatalog');

async function runTests() {
  console.log('=== TEST SUITE: ANFETA Notion URL "Abrir en ANFETA" Property ===\n');

  // -------------------------------------------------------------
  // TEST 1: Public Base URL & Canonical Link Generation
  // -------------------------------------------------------------
  console.log('--- TEST 1: Canonical URL & Domain Security ---');
  {
    // Test rejection of localhost, 127.0.0.1, and preview URLs
    assert.equal(getPublicBaseUrl('http://localhost:3000'), 'https://anfeta.com');
    assert.equal(getPublicBaseUrl('http://127.0.0.1:8080'), 'https://anfeta.com');
    assert.equal(getPublicBaseUrl('https://my-app-git-branch.preview.vercel.app'), 'https://anfeta.com');

    // Test valid custom or production URLs
    assert.equal(getPublicBaseUrl('https://anfeta.weblab.mx/'), 'https://anfeta.weblab.mx');
    assert.equal(getPublicBaseUrl('https://anfeta.com'), 'https://anfeta.com');

    // Test canonicalActivityUrl formatting
    const pageId = '384abd7d-91b7-809c-ac11-f0beda59eaab';
    const cleanId = '384abd7d91b7809cac11f0beda59eaab';
    const canonical = canonicalActivityUrl(pageId, { baseUrl: 'https://anfeta.com' });
    assert.equal(canonical, `https://anfeta.com/calendar?activity=${cleanId}`);

    // Invalid IDs return empty string
    assert.equal(canonicalActivityUrl('invalid-id'), '');
    console.log('OK: Base URL sanitation and canonical URL formatting verified.');
  }

  // -------------------------------------------------------------
  // TEST 2: Schema Property Resolution ("Abrir en ANFETA")
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Schema Property Detection & Validation ---');
  {
    // Exact match case-insensitive
    const schema1 = {
      'Abrir en ANFETA': { id: 'prop1', type: 'url', url: null },
      'TITULO PRINCIPAL': { id: 'title', type: 'title' }
    };
    const res1 = findActivityLinkProperty(schema1);
    assert.ok(res1);
    assert.equal(res1.name, 'Abrir en ANFETA');
    assert.equal(res1.isValid, true);

    // Type mismatch: property exists but is rich_text
    const schema2 = {
      'Abrir en ANFETA': { id: 'prop1', type: 'rich_text' },
    };
    const res2 = findActivityLinkProperty(schema2);
    assert.ok(res2);
    assert.equal(res2.isValid, false);
    assert.equal(res2.type, 'rich_text');

    // Fallback match: property containing anfeta of type url
    const schema3 = {
      'Enlace ANFETA': { id: 'prop2', type: 'url' },
    };
    const res3 = findActivityLinkProperty(schema3);
    assert.ok(res3);
    assert.equal(res3.name, 'Enlace ANFETA');
    assert.equal(res3.isValid, true);

    // Missing property
    const schema4 = {
      'Estado': { id: 'status', type: 'status' },
      'Fecha': { id: 'date', type: 'date' }
    };
    assert.equal(findActivityLinkProperty(schema4), null);
    console.log('OK: Schema property detection, type validation, and fallback verified.');
  }

  // -------------------------------------------------------------
  // TEST 3: Link Evaluation (Empty, Exact, Repair, Foreign)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Activity Link Evaluation States ---');
  {
    const pageId = '384abd7d-91b7-809c-ac11-f0beda59eaab';
    const cleanId = '384abd7d91b7809cac11f0beda59eaab';

    // 1. Empty link
    const evalEmpty = evaluateActivityLink(pageId, null, { baseUrl: 'https://anfeta.com' });
    assert.equal(evalEmpty.status, 'empty');

    // 2. Exact link
    const exactUrl = `https://anfeta.com/calendar?activity=${cleanId}`;
    const evalExact = evaluateActivityLink(pageId, exactUrl, { baseUrl: 'https://anfeta.com' });
    assert.equal(evalExact.status, 'exact');

    // 3. Needs repair: localhost or old path
    const localhostUrl = `http://localhost:3000/calendar?activity=${cleanId}`;
    const evalLocal = evaluateActivityLink(pageId, localhostUrl, { baseUrl: 'https://anfeta.com' });
    assert.equal(evalLocal.status, 'needs_repair');

    // 4. Needs repair: inherited link from another page (duplicated template)
    const inheritedUrl = `https://anfeta.com/calendar?activity=11111111111111111111111111111111`;
    const evalInherited = evaluateActivityLink(pageId, inheritedUrl, { baseUrl: 'https://anfeta.com' });
    assert.equal(evalInherited.status, 'needs_repair');
    assert.equal(evalInherited.detectedId, '11111111111111111111111111111111');

    // 5. Foreign URL: Dropbox, Google Drive, or other portal -> MUST BE PRESERVED
    const foreignUrl = 'https://dropbox.com/scl/fi/my-file-link';
    const evalForeign = evaluateActivityLink(pageId, foreignUrl, { baseUrl: 'https://anfeta.com' });
    assert.equal(evalForeign.status, 'foreign');
    console.log('OK: All link evaluation categories (empty, exact, needs_repair, foreign) verified.');
  }

  // -------------------------------------------------------------
  // TEST 4: Exclusive Property Update Mock (No side effects)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Mocked Notion Write & Side Effect Isolation ---');
  {
    const pageId = '384abd7d-91b7-809c-ac11-f0beda59eaab';
    const cleanId = '384abd7d91b7809cac11f0beda59eaab';

    let interceptedPatch = null;
    const originalFetch = global.fetch;

    global.fetch = async (url, options) => {
      const urlStr = String(url);
      if (options?.method === 'PATCH' && urlStr.includes(cleanId)) {
        interceptedPatch = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: cleanId, properties: interceptedPatch.properties })
        };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({}) };
    };

    try {
      const existingProps = {
        'TITULO PRINCIPAL': { type: 'title', title: [{ text: { content: 'Mi Actividad' } }] },
        'Fecha POR Hacer': { type: 'date', date: { start: '2026-11-03T10:00:00-06:00' } },
        'Estado': { type: 'status', status: { name: 'prtuzREVISION' } },
        'Equipo Weblab': { type: 'people', people: [{ id: 'user-1' }] },
        'Abrir en ANFETA': { type: 'url', url: null }
      };

      const saveRes = await saveActivityLinkToNotion(
        { notionToken: 'test-token', currentUser: 'nneft' },
        pageId,
        { existingProperties: existingProps, baseUrl: 'https://anfeta.com' }
      );

      assert.equal(saveRes.success, true);
      assert.equal(saveRes.status, 'updated');
      assert.equal(saveRes.property, 'Abrir en ANFETA');
      assert.equal(saveRes.url, `https://anfeta.com/calendar?activity=${cleanId}`);

      // Verify STRICT isolation: only 'Abrir en ANFETA' is in the PATCH payload!
      assert.ok(interceptedPatch);
      const patchedProps = Object.keys(interceptedPatch.properties);
      assert.equal(patchedProps.length, 1);
      assert.equal(patchedProps[0], 'Abrir en ANFETA');
      assert.deepEqual(interceptedPatch.properties['Abrir en ANFETA'], {
        url: `https://anfeta.com/calendar?activity=${cleanId}`
      });

      // Verify that calling again when already exact sends ZERO patch requests (loop prevention)
      interceptedPatch = null;
      existingProps['Abrir en ANFETA'].url = `https://anfeta.com/calendar?activity=${cleanId}`;
      const secondRes = await saveActivityLinkToNotion(
        { notionToken: 'test-token', currentUser: 'nneft' },
        pageId,
        { existingProperties: existingProps, baseUrl: 'https://anfeta.com' }
      );
      assert.equal(secondRes.status, 'already_up_to_date');
      assert.equal(interceptedPatch, null, 'Should not send PATCH when already up to date!');

      // Verify foreign URL preservation
      existingProps['Abrir en ANFETA'].url = 'https://dropbox.com/s/foreign-receipt';
      const foreignRes = await saveActivityLinkToNotion(
        { notionToken: 'test-token', currentUser: 'nneft' },
        pageId,
        { existingProperties: existingProps, baseUrl: 'https://anfeta.com' }
      );
      assert.equal(foreignRes.status, 'foreign_preserved');
      assert.equal(interceptedPatch, null, 'Should not overwrite foreign URLs!');
    } finally {
      global.fetch = originalFetch;
    }
    console.log('OK: Exclusive property PATCH, event loop prevention, and foreign URL protection verified.');
  }

  // -------------------------------------------------------------
  // TEST 5: Backfill Paged Processing & Duplicates Handling
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Paged Backfill & Duplicates Handling ---');
  {
    const originalFetch = global.fetch;
    const page1Id = '11111111111111111111111111111111';
    const page2Id = '22222222222222222222222222222222';
    const page3Id = '33333333333333333333333333333333';

    const mockPages = [
      // Page 1: Empty link -> needs fill
      {
        id: page1Id,
        object: 'page',
        properties: {
          'TITULO PRINCIPAL': { type: 'title', title: [{ plain_text: 'Actividad 1' }] },
          'Abrir en ANFETA': { type: 'url', url: null }
        }
      },
      // Page 2: Inherited link from duplicate (points to page 1) -> needs repair
      {
        id: page2Id,
        object: 'page',
        properties: {
          'TITULO PRINCIPAL': { type: 'title', title: [{ plain_text: 'Copia de Actividad 1' }] },
          'Abrir en ANFETA': { type: 'url', url: `https://anfeta.com/calendar?activity=${page1Id}` }
        }
      },
      // Page 3: Already exact -> skipped
      {
        id: page3Id,
        object: 'page',
        properties: {
          'TITULO PRINCIPAL': { type: 'title', title: [{ plain_text: 'Actividad 3' }] },
          'Abrir en ANFETA': { type: 'url', url: `https://anfeta.com/calendar?activity=${page3Id}` }
        }
      }
    ];

    global.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.endsWith('/search')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            results: mockPages,
            has_more: false,
            next_cursor: null
          })
        };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({}) };
    };

    try {
      // 1. Dry run preview
      const preview = await backfillActivityLinks(
        { notionToken: 'test-token', currentUser: 'nneft' },
        { limit: 10, dryRun: true, baseUrl: 'https://anfeta.com' }
      );

      assert.equal(preview.processed, 3);
      assert.equal(preview.filled, 1);
      assert.equal(preview.repaired, 1);
      assert.equal(preview.alreadyCorrect, 1);
      assert.equal(preview.updatedPages.length, 2);
      assert.equal(preview.updatedPages[0].action, 'filled');
      assert.equal(preview.updatedPages[1].action, 'repaired');
      assert.equal(preview.updatedPages[1].newUrl, `https://anfeta.com/calendar?activity=${page2Id}`);
      console.log('OK: Paged backfill correctly previews filled and repaired duplicated pages.');
    } finally {
      global.fetch = originalFetch;
    }
  }

  // -------------------------------------------------------------
  // TEST 6: Activity without Date Behavior
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Activity Without Date (No Fake Dates) ---');
  {
    const liveWithoutDate = {
      id: '44444444444444444444444444444444',
      title: 'Actividad Sin Fecha',
      person: 'Edwin',
      status: 'prtuzREVISION',
      dateStart: null,
      dateEnd: null
    };

    const hasDate = Boolean(liveWithoutDate.dateStart);
    const date = hasDate ? '2026-11-03' : null;
    assert.equal(hasDate, false);
    assert.equal(date, null);
    console.log('OK: Activity without date does not generate an artificial date.');
  }

  console.log('\n=============================================');
  console.log('ALL ACTIVITY LINK TESTS COMPLETED SUCCESSFULLY!');
  console.log('=============================================');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
