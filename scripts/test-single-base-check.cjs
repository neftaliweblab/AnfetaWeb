const fs = require('fs');
const path = require('path');

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

function getSettings() {
  const p1 = path.join(process.cwd(), 'settings.json');
  if (fs.existsSync(p1)) return JSON.parse(fs.readFileSync(p1, 'utf8'));
  const p2 = path.join(process.env.LOCALAPPDATA || 'C:/Users/nanoc/AppData/Local', 'AnfetaCalendarLab', 'settings.json');
  if (fs.existsSync(p2)) return JSON.parse(fs.readFileSync(p2, 'utf8'));
  return {};
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

async function queryDatabase(token, databaseId, retries = 1, timeoutMs = 8000) {
  const cleanId = databaseId.replace(/-/g, '');
  const url = `https://api.notion.com/v1/databases/${cleanId}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
      }, timeoutMs);

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
      // Pequeña espera antes de reintentar
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
  const settings = getSettings();
  const token = (settings.notionToken || '').trim();

  if (!token) {
    console.error('Error: Token de Notion no configurado en settings.json.');
    process.exit(1);
  }

  const basesToCheck = targetBaseName
    ? ANFETA_BASES.filter(([n]) => n.toLowerCase() === targetBaseName.toLowerCase())
    : ANFETA_BASES;

  if (basesToCheck.length === 0) {
    console.error(`Base "${targetBaseName}" no encontrada en el catálogo de ANFETA.`);
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`  VERIFICACIÓN DE BASES ANFETA (${basesToCheck.length} base${basesToCheck.length === 1 ? '' : 's'})`);
  console.log(`  Timeout por petición: 8s | Reintentos máx: 1`);
  console.log(`======================================================\n`);

  const results = [];

  for (let i = 0; i < basesToCheck.length; i++) {
    const [name, sourceId] = basesToCheck[i];
    const databaseId = NOTION_BASE_DATABASE_IDS[sourceId] || sourceId;
    const progress = `[${i + 1}/${basesToCheck.length}]`;

    console.log(`${progress} Verificando base: "${name}" (ID: ${databaseId})...`);

    const t0 = Date.now();
    const query = await queryDatabase(token, databaseId, 1, 8000);
    const duration = Date.now() - t0;

    if (!query.ok) {
      const errorMsg = query.status === 401
        ? 'Error 401 Unauthorized: El token de Notion es inválido o fue revocado.'
        : query.status === 404
        ? 'Error 404 Not Found: La integración no tiene acceso a esta base o la base no existe.'
        : query.status === 403
        ? 'Error 403 Forbidden: La integración no tiene permisos para leer esta base.'
        : (query.error || query.data?.message || `HTTP ${query.status}`);

      console.log(`     ↳ Estado: ERROR (${duration}ms) - ${errorMsg}`);
      results.push({
        name,
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
      console.log(`     ↳ Estado: OK (${duration}ms) - Propiedad "${linkMatch.name}" (tipo URL) verificada correctamente.`);
      results.push({
        name,
        databaseId,
        status: 'ok',
        propertyName: linkMatch.name,
        propertyId: linkMatch.id,
        propertyType: linkMatch.type,
      });
    } else if (linkMatch && !linkMatch.isValid) {
      console.log(`     ↳ Estado: TIPO INCORRECTO (${duration}ms) - ${linkMatch.error}`);
      results.push({
        name,
        databaseId,
        status: 'type_mismatch',
        propertyName: linkMatch.name,
        propertyId: linkMatch.id,
        propertyType: linkMatch.type,
        error: linkMatch.error,
      });
    } else {
      console.log(`     ↳ Estado: FALTA PROPIEDAD (${duration}ms) - No existe la propiedad "Abrir en ANFETA" (tipo URL).`);
      results.push({
        name,
        databaseId,
        status: 'missing',
        error: 'Falta la propiedad "Abrir en ANFETA" (tipo URL).',
        availableProperties: Object.keys(props),
      });
    }
  }

  console.log(`\n======================================================`);
  console.log(`  RESUMEN FINAL`);
  console.log(`======================================================`);
  const verifiedOk = results.filter(r => r.status === 'ok');
  const pending = results.filter(r => r.status !== 'ok');

  console.log(`Bases Verificadas OK: ${verifiedOk.length}/${results.length}`);
  verifiedOk.forEach(r => console.log(`  ✓ ${r.name}: Propiedad "${r.propertyName}" lista.`));

  console.log(`Bases Pendientes / Con Error: ${pending.length}/${results.length}`);
  pending.forEach(r => console.log(`  ✗ ${r.name} (${r.status}): ${r.error}`));

  return results;
}

const targetBase = process.argv[2] || null;
runVerification(targetBase).catch(e => {
  console.error('Error fatal:', e.message);
  process.exit(1);
});
