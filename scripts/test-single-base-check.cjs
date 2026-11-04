const fs = require('fs');
const path = require('path');

// Load environment from .env.local via @next/env
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

const ANFETA_BASES = [
  ['Revisiones', '2eeabd7d-91b7-8193-a131-000b08cd54e2'],
  ['Clientes', '2f0abd7d-91b7-810b-b1b8-000b85005b68'],
  ['Dominios', '2f0abd7d-91b7-8133-82e8-000b57bceeda'],
  ['Programas y proyectos', '796abd7d-91b7-8271-9154-0749f7d58213'],
  ['Cobrar y pagar', '2eeabd7d-91b7-815f-b649-000bfdc93a2b'],
  ['Correos Contraseñas', '2f1abd7d-91b7-8136-8cc2-000ba807c666'],
];

const NOTION_BASE_DATABASE_IDS = {
  '2eeabd7d-91b7-8193-a131-000b08cd54e2': '2eeabd7d-91b7-8134-8ed5-c537ec14962e',
  '2f0abd7d-91b7-810b-b1b8-000b85005b68': '2f0abd7d-91b7-81a0-993e-d4d3129ea46f',
  '2f0abd7d-91b7-8133-82e8-000b57bceeda': '2f0abd7d-91b7-8194-8d43-d2627adf2212',
  '796abd7d-91b7-8271-9154-0749f7d58213': '3cdabd7d-91b7-835c-af87-81ca85181639',
  '2eeabd7d-91b7-815f-b649-000bfdc93a2b': '2eeabd7d-91b7-81a5-a2ee-c9a20d3d656a',
  '2f1abd7d-91b7-8136-8cc2-000ba807c666': '2f1abd7d-91b7-81f5-bd6e-f2b1ecad4838',
};

function cleanToken(token) {
  if (!token) return '';
  return token.trim().replace(/^[:'"]+|[:'"]+$/g, '');
}

function resolveToken() {
  // process.env.NOTION_TOKEN from .env.local or Vercel takes absolute priority
  if (process.env.NOTION_TOKEN?.trim()) {
    return cleanToken(process.env.NOTION_TOKEN);
  }
  const p1 = path.join(process.cwd(), 'settings.json');
  if (fs.existsSync(p1)) {
    try {
      const s = JSON.parse(fs.readFileSync(p1, 'utf8'));
      if (s.notionToken) return cleanToken(s.notionToken);
    } catch {}
  }
  const p2 = path.join(process.env.LOCALAPPDATA || 'C:/Users/nanoc/AppData/Local', 'AnfetaCalendarLab', 'settings.json');
  if (fs.existsSync(p2)) {
    try {
      const s = JSON.parse(fs.readFileSync(p2, 'utf8'));
      if (s.notionToken) return cleanToken(s.notionToken);
    } catch {}
  }
  return '';
}

async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function checkUsersMe(token, timeoutMs = 8000) {
  const url = 'https://api.notion.com/v1/users/me';
  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    }, timeoutMs);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
    return {
      status: 0,
      ok: false,
      error: isTimeout ? `Timeout al consultar /users/me (${timeoutMs}ms)` : err.message,
    };
  }
}

async function queryDatabase(token, databaseId, retries = 1, timeoutMs = 8000) {
  const cleanId = databaseId.replace(/-/g, '');
  const url = `https://api.notion.com/v1/databases/${cleanId}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
      }, timeoutMs);

      // Handle 429 Too Many Requests with Retry-After
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after')) || 1;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.min(retryAfter * 1000, 3000)));
          continue;
        }
      }

      const data = await res.json().catch(() => ({ message: 'Respuesta no válida de Notion' }));
      return { status: res.status, ok: res.ok, data };
    } catch (err) {
      const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
      if (attempt === retries) {
        return {
          status: 0,
          ok: false,
          error: isTimeout ? `Timeout al consultar Notion (${timeoutMs}ms)` : err.message,
        };
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }
}

function findActivityLinkProperty(properties = {}) {
  const entries = Object.entries(properties);
  const exact = entries.find(([name]) => /^abrir en anfeta$/i.test(name.trim()));
  if (exact) {
    const [name, prop] = exact;
    return {
      name,
      type: prop?.type || 'unknown',
      id: prop?.id,
      isValid: prop?.type === 'url',
      error: prop?.type !== 'url' ? `Existe pero es tipo "${prop?.type}", no "url"` : undefined,
    };
  }
  const fallback = entries.find(([name, prop]) => prop?.type === 'url' && /abrir en anfeta|anfeta/i.test(name));
  if (fallback) {
    return { name: fallback[0], type: 'url', id: fallback[1]?.id, isValid: true };
  }
  return null;
}

async function runVerification(targetBaseName = null) {
  const token = resolveToken();

  if (!token) {
    console.error('Error: Token de Notion no configurado en .env.local ni en settings.json.');
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`  VERIFICACIÓN INICIAL NOTION - ANFETA`);
  console.log(`  Token: Configurado desde .env.local (protegido, no impreso)`);
  console.log(`  Timeout por petición: 8s | Reintentos máx: 1`);
  console.log(`======================================================\n`);

  // Paso 1: Verificación de credencial con /v1/users/me
  console.log(`[Paso 1] Verificando credencial en Notion API (GET /v1/users/me)...`);
  const t0 = Date.now();
  const meCheck = await checkUsersMe(token, 8000);
  const meDuration = Date.now() - t0;

  if (!meCheck.ok) {
    if (meCheck.status === 401) {
      console.error(`\n❌ ERROR 401 Unauthorized: La credencial de Notion es inválida o fue revocada.`);
      console.error(`   Se detiene inmediatamente la verificación para no generar peticiones fallidas.`);
      process.exit(1);
    }
    console.error(`\n❌ Error al consultar /v1/users/me (${meDuration}ms, HTTP ${meCheck.status}): ${meCheck.error || meCheck.data?.message || 'Error desconocido'}`);
    process.exit(1);
  }

  const botName = meCheck.data?.name || meCheck.data?.bot?.owner?.type || 'Bot de integración';
  console.log(`   ↳ Resultado: HTTP 200 OK (${meDuration}ms) | Bot: "${botName}"`);
  console.log(`   ↳ Credencial validada exitosamente.\n`);

  // Paso 2: Selección de bases (siempre se empieza con Revisiones)
  let basesToCheck;
  if (targetBaseName) {
    basesToCheck = ANFETA_BASES.filter(([n]) => n.toLowerCase() === targetBaseName.toLowerCase());
    if (basesToCheck.length === 0) {
      console.error(`Base "${targetBaseName}" no encontrada en el catálogo de ANFETA.`);
      process.exit(1);
    }
  } else {
    // Asegurar que Revisiones esté primera en la lista
    const rev = ANFETA_BASES.filter(([n]) => n.toLowerCase() === 'revisiones');
    const others = ANFETA_BASES.filter(([n]) => n.toLowerCase() !== 'revisiones');
    basesToCheck = [...rev, ...others];
  }

  console.log(`[Paso 2] Verificando bases habilitadas (${basesToCheck.length} base${basesToCheck.length === 1 ? '' : 's'})...\n`);

  const results = [];

  for (let i = 0; i < basesToCheck.length; i++) {
    const [name, sourceId] = basesToCheck[i];
    const databaseId = NOTION_BASE_DATABASE_IDS[sourceId] || sourceId;
    const progress = `[${i + 1}/${basesToCheck.length}]`;

    console.log(`${progress} Verificando base: "${name}" (data_source_id: ${sourceId} | database_id: ${databaseId})...`);

    const tb0 = Date.now();
    const query = await queryDatabase(token, databaseId, 1, 8000);
    const duration = Date.now() - tb0;

    if (!query.ok) {
      const errorMsg = query.status === 401
        ? 'Error 401 Unauthorized: El token de Notion no tiene autorización.'
        : query.status === 404
        ? 'Error 404 Not Found: La integración no tiene acceso a esta base o la base no existe.'
        : query.status === 403
        ? 'Error 403 Forbidden: La integración no tiene permisos de lectura sobre esta base.'
        : (query.error || query.data?.message || `HTTP ${query.status}`);

      console.log(`     ↳ Estado: ERROR (${duration}ms) - ${errorMsg}`);
      results.push({
        name,
        sourceId,
        databaseId,
        status: query.status === 401 ? 'unauthorized' : 'error',
        httpStatus: query.status,
        error: errorMsg,
      });
      continue;
    }

    const props = query.data?.properties || {};
    const linkMatch = findActivityLinkProperty(props);

    if (linkMatch && linkMatch.isValid) {
      console.log(`     ↳ Estado: OK (${duration}ms) | Propiedad encontrada: "${linkMatch.name}" (tipo: ${linkMatch.type}) [ID: ${linkMatch.id}]`);
      results.push({
        name,
        sourceId,
        databaseId,
        status: 'ready',
        propName: linkMatch.name,
        propId: linkMatch.id,
        propType: linkMatch.type,
      });
    } else if (linkMatch && !linkMatch.isValid) {
      console.log(`     ↳ Estado: ADVERTENCIA (${duration}ms) | Propiedad inválida: "${linkMatch.name}" (${linkMatch.error})`);
      results.push({
        name,
        sourceId,
        databaseId,
        status: 'invalid_type',
        propName: linkMatch.name,
        error: linkMatch.error,
      });
    } else {
      console.log(`     ↳ Estado: PENDIENTE (${duration}ms) | No existe la columna "Abrir en ANFETA".`);
      results.push({
        name,
        sourceId,
        databaseId,
        status: 'missing_property',
        error: 'Falta crear la propiedad "Abrir en ANFETA" (tipo URL).',
      });
    }
  }

  // Resumen final
  console.log(`\n======================================================`);
  console.log(`  RESUMEN DE AUDITORÍA DE BASES`);
  console.log(`======================================================`);
  console.log(`Total bases evaluadas: ${results.length}`);
  console.log(`  - Listas para sincronizar (con URL válida): ${results.filter(r => r.status === 'ready').length}`);
  console.log(`  - Pendientes (falta crear columna URL):     ${results.filter(r => r.status === 'missing_property').length}`);
  console.log(`  - Con tipo de propiedad incorrecto:       ${results.filter(r => r.status === 'invalid_type').length}`);
  console.log(`  - Errores de acceso o red:                ${results.filter(r => r.status === 'error' || r.status === 'unauthorized').length}`);
  console.log(`------------------------------------------------------`);

  for (const r of results) {
    const symbol = r.status === 'ready' ? '✅' : r.status === 'missing_property' ? '⏳' : '❌';
    const detail = r.status === 'ready'
      ? `"${r.propName}" (tipo: ${r.propType})`
      : r.error;
    console.log(`  ${symbol} ${r.name.padEnd(25)} : ${detail}`);
  }
  console.log(`======================================================\n`);

  return results;
}

// Support command-line arguments: e.g. node scripts/test-single-base-check.cjs --base=Revisiones
const args = process.argv.slice(2);
const baseArg = args.find(a => a.startsWith('--base='));
const targetBase = baseArg ? baseArg.split('=')[1] : (args[0] && !args[0].startsWith('-') ? args[0] : null);

runVerification(targetBase).catch(err => {
  console.error('Fallo en la ejecución:', err.message);
  process.exit(1);
});
