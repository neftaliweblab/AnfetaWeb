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

const { parseVisualParts, formatAreaLabel, formatMonthBadgeLabel, formatDisplayOrderParts, resolveItemDomain } = require(root + '/src/lib/visualTitleParser.ts');
const { buildQuickOpenSelectionSummary } = require(root + '/src/lib/quickOpenPlan.ts');
const { resultMonth, itemMatchesMonthFilter } = require(root + '/src/lib/searchMonthOrder.ts');
const { getOrderNumericRank } = require(root + '/src/lib/searchResultOrder.ts');
const { buildPersonWorkQuery, passiveReviewerTag, scanActivityTags } = require(root + '/src/services/activityTags.ts');
const { extractPersonFromWorkQuery } = require(root + '/src/lib/searchTabsStorage.ts');
const { calendarDomain, calendarDisplayTitle } = require(root + '/src/services/calendarPresentation.ts');
const { contentClassification, classifiedDomain } = require(root + '/src/lib/contentClassification.ts');
const { isBillingItem, isCobroItem, isPagoItem, getItemGroupKey, sortResultGroups } = require(root + '/src/lib/activeResultsFirst.ts');
const { normalizeSearchTabConfig } = require(root + '/src/lib/searchTabConfig.ts');
const { quickRevisionTitle } = require(root + '/src/lib/quickRevisionTitle.ts');
const { workflowState, isTerminadoHoyStatus, workflowBadgePresentation } = require(root + '/src/services/activityWorkflow.ts');
const { parseChecklistBlockDate, applyChecklistDateToRuns } = require(root + '/src/lib/checklistBlockDates.ts');
const { detectMediaKind } = require(root + '/src/components/MediaViewerModal.tsx');

test('§1 + §5: Nuevo formato 1./0., áreas visibles Aplicación/Software, f41.01, orden numérico, SEO y agrupación real por Dominio/Área', () => {
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

  // SEO con formato 11.s.f11.00 no debe confundirse con Software/PROG y [SSEO OOPT TTEC] debe limpiarse completo
  const seoF11 = parseVisualParts('prtuzR | 🔎 SSEO -- | 🌐 1.opticayoftalmologia.com.seo | 📅 11.s.f11.00 SEO Optimización Técnica / Reporte Mes | 🛠️ [SSEO OOPT TTEC] | 👥 nne11');
  assert.equal(seoF11.area, 'SEO');
  assert.equal(seoF11.domain, 'opticayoftalmologia.com');
  assert.doesNotMatch(seoF11.title, /OOPT|TTEC|\[/);

  // Dominios con # prefijo (#d.anfeta.com.03 / #1.anfeta.com) se conservan y agrupan por dominio real, no por Revisiones (BD)
  const recQuick = parseVisualParts('prtuzR | 🌐 Actividad rápida | 📅 26-[11NOV] Grabacion_jjo11 | 🌐 #d.anfeta.com.03 | 👤 jjo11 | ✅');
  assert.equal(recQuick.domain, 'anfeta.com');
  assert.equal(getItemGroupKey({ name: '111 prompt notion IA', sourceName: 'Revisiones' }, 'domain'), '🌐 Sin dominio');
  assert.equal(getItemGroupKey({ name: 'prtuzR | 🌐 #d.anfeta.com.03 | Demo', sourceName: 'Revisiones' }, 'domain'), '🌐 anfeta.com');
  const sortedDomGroups = sortResultGroups(
    [
      { key: '🌐 Sin dominio', items: [{ id: '1', name: '111 prompt notion IA' }] },
      { key: '🌐 anfeta.com', items: [{ id: '2', name: 'prtuzR | 1.anfeta.com | Fix' }] },
    ],
    'domain'
  );
  assert.equal(sortedDomGroups[0].key, '🌐 anfeta.com');
  assert.equal(sortedDomGroups[1].key, '🌐 Sin dominio');

  // Encabezados de Área nunca muestran APP/PROG en bruto y limpian ffase00
  assert.equal(getItemGroupKey({ name: realExample }, 'project_type'), '🏷️ Área: Aplicación');
  assert.equal(getItemGroupKey({ name: 'prtuzR | 💻 SSOFT | 11.s.03.00 Usos-weblab | 0.anfeta.com.03' }, 'project_type'), '🏷️ Área: Software');
  assert.doesNotMatch(parseVisualParts('01.00 REQUERIMIENTOS CONTROL DE JORNADA ffase00').title, /ffase00/i);
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

test('Cotización plantilla: no duplica sufijo .cotizacion y maneja link_mention/advertencias', async () => {
  const { buildCalendarQuickTemplateFinalTitle } = require(root + '/src/lib/templateCatalog.ts');
  const built = buildCalendarQuickTemplateFinalTitle({
    projectToken: 'ccoti',
    selectedDate: new Date('2026-11-18T10:00:00-06:00'),
    description: 'Cotizacion Etapas',
    domain: 'p.djexcavation.com.cotizacion',
    personName: 'Karla',
    templateOriginalTitle: 'prtuzR | 💻 ccoti | 📅 00.c.00.00 Cotizacion Etapas | 🌐 #p.dominio.com.cotizacion | 🛠 #descripcion | 💬 #ffase 00',
  });
  assert.match(built, /#p\.djexcavation\.com\.cotizacion \|/);
  assert.doesNotMatch(built, /\.cotizacion\.cotizacion/);

  // Mock Notion reads/writes for notionTemplateBody tolerant warning flow
  let mockTree = {
    tplPage: [
      { id: 'p-valid', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Paso 1' }, plain_text: 'Paso 1' }] } },
      { id: 'p-link-mention', type: 'paragraph', paragraph: { rich_text: [{ type: 'mention', mention: { type: 'link_mention', link_mention: { href: 'https://anfeta.com/cotizacion', title: 'Cotizador ANFETA' } }, plain_text: 'Cotizador ANFETA', href: 'https://anfeta.com/cotizacion' }] } },
      { id: 'p-empty-mention', type: 'paragraph', paragraph: { rich_text: [{ type: 'mention', mention: { type: 'link_preview', link_preview: { url: 'https://example.com/ref' } }, plain_text: 'https://example.com/ref' }] } },
      { id: 'p-restricted', type: 'meeting_notes', meeting_notes: { block_type: 'meeting_notes' } },
      { id: 'p-notion-400', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Bloque que rechaza Notion al escribir' }, plain_text: 'Bloque que rechaza Notion al escribir' }] } },
      { id: 'p-todo', type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: 'Enviar propuesta' }, plain_text: 'Enviar propuesta' }], checked: false } },
    ],
  };
  let appendedChildren = [];
  const origLoad = Module._load;
  Module._load = function (name, parent, ...rest) {
    if (parent?.filename.endsWith('notionTemplateBody.ts')) {
      if (name === './notionCalendar') return { readBlocks: async (_s, id) => structuredClone(mockTree[id] || []) };
      if (name === './notionMutations') {
        return {
          notionRequest: async (_s, _url, method, body) => {
            if (method === 'DELETE') return {};
            const hasFailingBlock = (body?.children || []).some((b) =>
              b?.paragraph?.rich_text?.[0]?.text?.content?.includes('rechaza Notion')
            );
            if (hasFailingBlock) {
              throw new Error('Notion API 400: invalid test block');
            }
            appendedChildren.push(...(body?.children || []));
            return { results: (body?.children || []).map((_, idx) => ({ id: 'created-' + appendedChildren.length + '-' + idx })) };
          },
        };
      }
    }
    return origLoad.call(this, name, parent, ...rest);
  };
  try {
    delete require.cache[require.resolve(root + '/src/services/notionTemplateBody.ts')];
    const { prepareTemplateBodyWithWarnings, appendTemplateBodyWithWarnings } = require(root + '/src/services/notionTemplateBody.ts');
    const prep = await prepareTemplateBodyWithWarnings({}, 'tplPage');
    // meeting_notes omitted with warning; link_mention & link_preview converted cleanly to text runs with links
    assert.equal(prep.warnings.length, 1);
    assert.match(prep.warnings[0], /meeting_notes/);
    assert.equal(prep.nodes.length, 5);
    assert.equal(prep.nodes[1].block.paragraph.rich_text[0].type, 'text');
    assert.equal(prep.nodes[1].block.paragraph.rich_text[0].text.link.url, 'https://anfeta.com/cotizacion');
    assert.equal(prep.nodes[2].block.paragraph.rich_text[0].type, 'text');
    assert.equal(prep.nodes[2].block.paragraph.rich_text[0].text.link.url, 'https://example.com/ref');

    const app = await appendTemplateBodyWithWarnings({}, 'destPage', prep.nodes);
    assert.equal(app.appendedCount, 4);
    assert.equal(app.warnings.length, 1);
    assert.match(app.warnings[0], /rechaza Notion/);
    assert.equal(appendedChildren.length, 4);
    assert.equal(appendedChildren[3].type, 'to_do');
  } finally {
    Module._load = origLoad;
  }
});

test('Reunión 18/11 tarde: numeración visual sin f/cero inicial, área webs y transición pprtuz <-> prtuz', () => {
  assert.deepEqual(formatDisplayOrderParts('f01.01'), { full: '1.01', major: '1', minor: '.01' });
  assert.deepEqual(formatDisplayOrderParts('f12.01'), { full: '12.01', major: '12', minor: '.01' });
  assert.deepEqual(formatDisplayOrderParts('01.00'), { full: '1.00', major: '1', minor: '.00' });
  assert.deepEqual(formatDisplayOrderParts('f0.51'), { full: '0.51', major: '0', minor: '.51' });
  assert.deepEqual(formatDisplayOrderParts('f41.01'), { full: '41.01', major: '41', minor: '.01' });

  const webParsed = parseVisualParts('prtuzR | 💻 wwebs | 🌐 1.ejemplo.com.webs | 📅 11.w.f01.01 Header Menú');
  assert.equal(webParsed.orderCode, 'f01.01');
  assert.equal(formatAreaLabel(webParsed.area), 'webs');
  assert.equal(formatAreaLabel('WEB'), 'webs');

  const { progressiveStage, stripProgressiveStage, revisionPhaseTitle } = require(root + '/src/services/progressiveWorkflow.ts');
  const stage = progressiveStage('pprtuzR | 💻 wwebs | 📅 11.w.f01.01 Header Menú');
  assert.equal(stage?.code, 'pprtuzR');
  assert.equal(stage?.state, 'pending');
  assert.equal(stripProgressiveStage('pprtuzR | 💻 wwebs | 📅 11.w.f01.01 Header Menú').trim(), '| 💻 wwebs | 📅 11.w.f01.01 Header Menú');

  const toToday = revisionPhaseTitle('prtuzR | 💻 wwebs | 📅 11.w.f01.01 Header Menú | 👥 nne11', 'completed_today');
  assert.equal(toToday, 'pprtuzR | 💻 wwebs | 📅 11.w.f01.01 Header Menú | 👥 nne11');

  const backToPending = revisionPhaseTitle(toToday, 'pending');
  assert.equal(backToPending, 'prtuzR | 💻 wwebs | 📅 11.w.f01.01 Header Menú | 👥 nne11');

  const { pprtuzResetCandidate } = require(root + '/src/services/pprtuzDailyReset.ts');
  const makePage = (title, status, edited, locked = false) => ({
    id: 'page-1',
    last_edited_time: edited,
    archived: false,
    in_trash: false,
    properties: {
      Name: { type: 'title', title: [{ plain_text: title }] },
      Estado: { type: 'select', select: { name: status } },
      Responsable: { type: 'people', people: [{ name: 'Neftali' }] },
      Bloqueado: { type: 'checkbox', checkbox: locked },
    },
  });

  // Finished yesterday -> must reset at 01:00 AM next day
  assert.equal(
    pprtuzResetCandidate(makePage('pprtuzR | 💻 wwebs | Tarea', 'PPRTUZ TERMINADO-HOY-(POR HACER)', '2026-11-18T22:15:00-06:00'), 'Neftali', '2026-11-19'),
    true
  );
  // Already in review (rtuz) -> never reset back to pending
  assert.equal(
    pprtuzResetCandidate(makePage('rtuzR | 💻 wwebs | Tarea', 'EN REVISIÓN', '2026-11-18T22:15:00-06:00'), 'Neftali', '2026-11-19'),
    false
  );
  // Marked after 00:55 AM of current day -> protect current day's progress
  assert.equal(
    pprtuzResetCandidate(makePage('pprtuzR | 💻 wwebs | Tarea', 'PPRTUZ TERMINADO-HOY-(POR HACER)', '2026-11-19T01:30:00-06:00'), 'Neftali', '2026-11-19'),
    false
  );
  // A completion at 00:30 belongs to the new day, never reset at 01:00.
  assert.equal(pprtuzResetCandidate(makePage('pprtuzR Tarea', 'PPRTUZ TERMINADO-HOY-(POR HACER)', '2026-11-19T00:30:00-06:00'), 'Neftali', '2026-11-19'), false);
  assert.equal(pprtuzResetCandidate(makePage('pprtuzR Tarea', 'PPRTUZ TERMINADO-HOY-(POR HACER)', ''), 'Neftali', '2026-11-19'), false);
  // Locked page -> protected
  assert.equal(
    pprtuzResetCandidate(makePage('pprtuzR | 💻 wwebs | Tarea', 'PPRTUZ TERMINADO-HOY-(POR HACER)', '2026-11-18T22:15:00-06:00', true), 'Neftali', '2026-11-19'),
    false
  );
});

test('10) Visual month badges format 11 -> 11NOV and parse both 11.a.f41.00 and 11NOV.a.f41.00 cleanly', () => {
  assert.equal(formatMonthBadgeLabel('11'), '11NOV');
  assert.equal(formatMonthBadgeLabel('01'), '01ENE');
  assert.equal(formatMonthBadgeLabel('12'), '12DIC');
  assert.equal(formatMonthBadgeLabel('09SEPT'), '09SEP');

  const longPrefixed =
    'pprtuzD | 💻 AAPLI -- | 🌐 0.anfeta.com.aplicacion | 📅 11NOV.a.f41.00 Asistente recurrente: corregir funciones';
  const parsedLong = parseVisualParts(longPrefixed);
  assert.equal(formatMonthBadgeLabel(parsedLong.monthCode), '11NOV');
  assert.equal(parsedLong.orderCode, 'f41.00');
  assert.equal(parsedLong.area, 'APP');
  assert.equal(parsedLong.domain, 'anfeta.com');
  assert.equal(parsedLong.title, 'Asistente recurrente: corregir funciones');

  const parsedNumeric = parseVisualParts('11.a.f43.00 Asistente recurrente');
  assert.equal(parsedNumeric.monthCode, '11');
  assert.equal(formatMonthBadgeLabel(parsedNumeric.monthCode), '11NOV');
  assert.equal(parsedNumeric.orderCode, 'f43.00');
  assert.equal(parsedNumeric.area, 'APP');
  assert.equal(parsedNumeric.title, 'Asistente recurrente');

  assert.deepEqual(resultMonth({ name: '11.a.f41.00 Tarea' }), { year: 0, month: 11 });
  assert.equal(itemMatchesMonthFilter({ name: '11.a.f41.00 Tarea' }, '11NOV'), true);
  assert.equal(itemMatchesMonthFilter({ name: '11NOV.a.f43.00 Tarea' }, '11NOV'), true);
  assert.equal(itemMatchesMonthFilter({ name: '10.a.f41.00 Tarea' }, '11NOV'), false);

  assert.ok(
    getOrderNumericRank({ name: '11NOV.a.f41.00' }) < getOrderNumericRank({ name: '11NOV.a.f43.00' })
  );
});

test('11) FTFs normalizan dominios de persona o sin dominio a anfeta.com y badges Formato/En contenido van en fila', () => {
  const grokFtfTitle = 'Calendario CCALE NNOTI AACTI FTF FFFTFF JJOFTF INCIAL 0.john.com Grok bot --- FTF JJOFTF-FF';
  assert.equal(calendarDomain(grokFtfTitle), 'anfeta.com');
  assert.ok(!calendarDisplayTitle(grokFtfTitle).includes('john.com'));
  assert.equal(resolveItemDomain({ name: grokFtfTitle }), 'anfeta.com');
  assert.equal(getItemGroupKey({ name: grokFtfTitle }, 'domain'), '🌐 anfeta.com');

  for (const [title, chip] of [
    ['Final Grok bot --- FTF jjofTF final', 'john.com'],
    ['GGSTF Calendario 0000000 CCALE NNOTI AACTI FTF - MOVER AL TERMINAR JJOFF', 'genaro.com'],
    ['[p] 1.00 FTF | TERMINADO 12 Calendario 0000000 CCALE NNOTI AACTI FTF | prtuzR MOVER AL TERMINAR KKAFF', 'karla.com'],
    ['tuzCalendario AANDRADE Calendario 0000000 CCALE NNOTI AACTI FTF AANFF', 'andrade.com'],
    ['NNEFT FTF JJOFTF', 'neftali.com'],
    ['TERMINADO FTF Calendario 0000000 CCALE NNOTI AACTI FTF - MOVER AL TERMINAR', ''],
  ]) {
    assert.equal(resolveItemDomain({ name: title, domainChip: chip }), 'anfeta.com', `${title} (${chip})`);
    assert.equal(getItemGroupKey({ name: title, domainChip: chip }, 'domain'), '🌐 anfeta.com');
  }

  // Dominio explícito no personal en un item distinto (ej. weblab.mx) o actividad sin FTF se conservan
  assert.equal(resolveItemDomain({ name: 'PRACTICANTES FTF --- QAATITUD', domainChip: 'weblab.mx' }), 'weblab.mx');
  assert.equal(resolveItemDomain({ name: 'Proyecto cliente', domainChip: 'novakid.com' }), 'novakid.com');

  const badgesSrc = fs.readFileSync(path.join(root, 'src/components/ResultsViewHost/ResultIdentityBadges.tsx'), 'utf8');
  assert.match(badgesSrc, /shrink-0 whitespace-nowrap[^>]*>⚠️ Formato/);
  assert.match(badgesSrc, /shrink-0 whitespace-nowrap[^>]*>En contenido/);

  const tableSrc = fs.readFileSync(path.join(root, 'src/components/ResultsViewHost/ResultsVirtualTable.tsx'), 'utf8');
  assert.match(tableSrc, /border-\[#60A5FA\]\/30[^"]*\{highlightMatch|rounded bg-\[#1E293B\]\/70 border border-\[#60A5FA\]\/30/);
});

test('12) Aviso rápido para abrir 1 o varios resultados seleccionados en Notion', () => {
  const one = buildQuickOpenSelectionSummary([
    {
      id: '11111111111111111111111111111111',
      name: '[Revisiones] Configuracion inicial WordPress',
      source: 'Notion',
      externalUrl: 'https://www.notion.so/11111111111111111111111111111111',
    },
  ]);
  assert.equal(one.totalSelected, 1);
  assert.equal(one.notionUrls.length, 1);
  assert.match(one.headline, /¿Quieres verlo en Notion\?/);
  assert.equal(one.buttonLabel, 'Abrir en Notion ↗');

  const multi = buildQuickOpenSelectionSummary([
    { id: 'a1', name: 'Uno', source: 'Notion', externalId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    { id: 'a2', name: 'Dos', source: 'Notion', externalId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    { id: 'a3', name: 'Duplicado', source: 'Notion', externalId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  ]);
  assert.equal(multi.totalSelected, 3);
  assert.equal(multi.notionUrls.length, 2);
  assert.match(multi.headline, /3 resultados seleccionados/);
  assert.equal(multi.buttonLabel, 'Abrir 2 en Notion ↗');
  assert.equal(multi.cappedWarning, '');

  const capped = buildQuickOpenSelectionSummary(
    Array.from({ length: 18 }, (_, i) => ({
      id: `item-${i}`,
      name: `Act ${i}`,
      source: 'Notion',
      externalId: `${String(i + 10).padStart(32, '0')}`,
    })),
    15
  );
  assert.equal(capped.launchUrls.length, 15);
  assert.match(capped.buttonLabel, /Abrir primeros 15 de 18 en Notion/);
  assert.match(capped.cappedWarning, /15 pestañas/);

  const tableSrc = fs.readFileSync(path.join(root, 'src/components/ResultsViewHost/ResultsVirtualTable.tsx'), 'utf8');
  assert.match(tableSrc, /Abrir rápido en Notion \(1 clic\)/);
});
