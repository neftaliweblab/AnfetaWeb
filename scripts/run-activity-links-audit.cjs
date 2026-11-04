const fs = require('fs');
const path = require('path');
const Module = require('module');

const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
if (process.cwd().replace(/\\/g, '/') !== root) process.chdir(root);

// 1. Load environment from .env.local via @next/env
try {
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(process.cwd());
} catch {
  try {
    const envLocalPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim().replace(/^[:'"]+|[:'"]+$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {}
}

// 2. Setup TypeScript on-the-fly compilation for requiring .ts modules
const ts = require(path.join(root, 'node_modules/typescript'));
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return resolve.call(this, name, parent, ...rest);
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

const { getSettings } = require(root + '/src/services/serverSettings.ts');
const {
  auditBasesActivityLinks,
  executeBasesBackfill,
  findActivityLinkProperty,
} = require(root + '/src/services/activityLinkService.ts');
const { getPublicBaseUrl } = require(root + '/src/lib/activityCanonicalLink.ts');

async function main() {
  const args = process.argv.slice(2);
  const isFill = args.includes('--fill') || args.includes('--execute');
  const baseArg = args.find((a) => a.startsWith('--base='));
  const targetBase = baseArg ? baseArg.split('=')[1] : null;
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 25;

  const settings = getSettings();
  const token = (process.env.NOTION_TOKEN || settings.notionToken || '').trim().replace(/^[:'"]+|[:'"]+$/g, '');

  if (!token) {
    console.error('ERROR: NOTION_TOKEN no encontrado en .env.local ni en settings.json.');
    process.exit(1);
  }

  const publicUrl = getPublicBaseUrl();

  console.log('=================================================================');
  console.log(`  OPERACIÓN: ${isFill ? 'LLENADO REAL DE ENLACES' : 'AUDITORÍA / VISTA PREVIA'} "Abrir en ANFETA"`);
  console.log('  Token: Cargado desde .env.local (activo, protegido)');
  console.log(`  Dominio canónico público: ${publicUrl}`);
  console.log(`  Límite de páginas por base: ${limit}`);
  console.log(`  Base objetivo: ${targetBase || 'Todas las habilitadas (Revisiones primero)'}`);
  console.log('=================================================================\n');

  // Si es solo auditoría o vista previa:
  if (!isFill) {
    console.log('[Auditoría] Consultando estado de propiedades y páginas en Notion...\n');
    const audit = await auditBasesActivityLinks(
      { ...settings, notionToken: token },
      {
        maxPagesPerBase: limit,
        baseNames: targetBase ? [targetBase] : undefined,
        baseUrl: publicUrl,
        timeoutMs: 8000,
        onProgress: (p) => {
          console.log(`  [Progreso] Base ${p.baseName}: ${p.stage} (${p.current}/${p.total})`);
        },
      }
    );

    console.log('\n=================================================================');
    console.log('  RESULTADO DE LA AUDITORÍA POR BASE');
    console.log('=================================================================');
    for (const base of audit.bases) {
      console.log(`\nBase: "${base.baseName}" (Data Source: ${base.dataSourceId} | DB: ${base.databaseId})`);
      console.log(`  Propiedad "Abrir en ANFETA": ${base.propertyStatus === 'ok' ? '✅ ' + base.propertyName + ' (tipo URL)' : '⏳ ' + base.statusMessage}`);
      console.log(`  Páginas analizadas: ${base.pagesReviewed}`);
      console.log(`    - Enlaces vacíos (requieren llenado):   ${base.emptyCount}`);
      console.log(`    - Enlaces correctos y exactos:          ${base.correctCount}`);
      console.log(`    - Enlaces que requieren reparación:     ${base.repairedCount}`);
      console.log(`    - Enlaces ajenos (conservados):         ${base.foreignCount}`);
      console.log(`    - Omitidas (archivadas o papelera):     ${base.omittedCount}`);

      if (base.pages && base.pages.length > 0) {
        console.log(`\n  Muestra de páginas evaluadas:`);
        for (const p of base.pages.slice(0, 10)) {
          const sym = p.status === 'exact' ? '✅' : p.status === 'empty' ? '⏳' : p.status === 'needs_repair' ? '🔧' : '🌐';
          console.log(`    ${sym} [${p.status}] "${p.title.slice(0, 50)}" -> ${p.existingUrl || '(vacío)'}`);
        }
      }
    }

    console.log('\n=================================================================');
    console.log('  TOTALES GENERALES');
    console.log('=================================================================');
    console.log(`Bases listas:       ${audit.totals.basesReady}`);
    console.log(`Bases pendientes:   ${audit.totals.basesPending}`);
    console.log(`Páginas revisadas:  ${audit.totals.pagesReviewed}`);
    console.log(`Enlaces vacíos:     ${audit.totals.emptyCount}`);
    console.log(`Enlaces correctos:  ${audit.totals.correctCount}`);
    console.log(`Por reparar:        ${audit.totals.repairedCount}`);
    console.log(`Enlaces ajenos:     ${audit.totals.foreignCount}`);
    console.log('=================================================================\n');

    return audit;
  }

  // Si es llenado real (--fill):
  console.log('[Llenado] Ejecutando llenado controlado de enlaces en Notion...\n');
  const fillReport = await executeBasesBackfill(
    { ...settings, notionToken: token },
    {
      dryRun: false,
      limitPerBase: limit,
      baseNames: targetBase ? [targetBase] : undefined,
      baseUrl: publicUrl,
      timeoutMs: 8000,
      onProgress: (p) => {
        console.log(`  [Progreso] Base ${p.baseName}: ${p.stage} (${p.current}/${p.total})`);
      },
    }
  );

  console.log('\n=================================================================');
  console.log('  RESULTADO DEL LLENADO EN NOTION');
  console.log('=================================================================');
  for (const base of fillReport.bases) {
    console.log(`\nBase: "${base.baseName}"`);
    console.log(`  Propiedad: ${base.propertyStatus === 'ok' ? '✅ ' + base.propertyName : '⏳ ' + base.statusMessage}`);
    console.log(`  Páginas revisadas:            ${base.pagesReviewed}`);
    console.log(`  Enlaces vacíos completados:   ${base.emptyCount}`);
    console.log(`  Enlaces propios reparados:    ${base.repairedCount}`);
    console.log(`  Enlaces exactos ya al día:    ${base.correctCount}`);
    console.log(`  Enlaces externos conservados: ${base.foreignCount}`);
    console.log(`  Fallidas / Errores:           ${base.failedCount}`);

    if (base.pages && base.pages.length > 0) {
      console.log(`\n  Detalle de páginas procesadas:`);
      for (const u of base.pages.slice(0, 10)) {
        console.log(`    - [${u.reason}] "${u.title.slice(0, 45)}" -> ${u.url}`);
      }
    }
  }

  console.log('\n=================================================================');
  console.log('  TOTALES DEL LLENADO');
  console.log('=================================================================');
  console.log(`Páginas revisadas:        ${fillReport.totals.pagesReviewed}`);
  console.log(`Enlaces vacíos llenados:  ${fillReport.totals.emptyCount}`);
  console.log(`Enlaces propios reparados:${fillReport.totals.repairedCount}`);
  console.log(`Enlaces ya exactos:       ${fillReport.totals.correctCount}`);
  console.log(`Enlaces ajenos conservados:${fillReport.totals.foreignCount}`);
  console.log(`Páginas fallidas:         ${fillReport.totals.failedCount}`);
  console.log('=================================================================\n');

  return fillReport;
}

main().catch((err) => {
  console.error('Error durante la ejecución:', err);
  process.exit(1);
});
