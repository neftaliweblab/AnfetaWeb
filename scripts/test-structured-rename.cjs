const STATUS_REGEX = /(?<![\w@.\/-])(saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|rtuz|tuz|uz|z)([rRsS]?)|(sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION|zCOBRAR|zPAGAR|eed11|ed11|nne11|bbria)(?![\w@.\/-])/i;

function parseActivityTitleParts(rawTitle) {
  const title = (rawTitle || '').trim();
  let remaining = title;

  // 1. Detect Status Token ANYWHERE in the string
  let status = '';
  let statusPosition = 'start'; // 'start' | 'before_blocks'
  const statusMatch = remaining.match(/(?<![\w@.\/-])(?:(saprtuz|aaprtuz|aartuz|aapr|aprtuz|prtuz|rtuz|tuz|uz|z)([rRsS]?)|(sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION|zCOBRAR|zPAGAR|eed11|ed11|nne11|bbria))(?![\w@.\/-])/i);
  if (statusMatch) {
    status = statusMatch[0];
    const matchIndex = statusMatch.index || 0;
    if (remaining.includes('|') && matchIndex > 0) {
      statusPosition = 'before_blocks';
    } else {
      statusPosition = 'start';
    }
    remaining = (remaining.slice(0, matchIndex) + ' ' + remaining.slice(matchIndex + status.length)).trim();
  }

  // 2. Extract Code / Phase / Order
  let code = '';
  const codeMatch = remaining.match(/(?<![a-z0-9])(\d{1,2}\.[a-z0-9.]+|ffase\d+|fase\d+|0\d\.\d{2})(?![a-z0-9])/i);
  if (codeMatch) {
    code = codeMatch[1];
    remaining = remaining.replace(codeMatch[0], ' ').trim();
  }

  // 3. Extract Month: check standalone 2-digit number first so it does not leak into description
  let month = '';
  const legacyMonthMatch = remaining.match(/(?:\d{2}-)?\[?(\d{2})[A-ZÁÉÍÓÚ]{3,4}\]?/i);
  const numMonthMatch = remaining.match(/(?<![a-z0-9.])(0[1-9]|1[0-2])(?![a-z0-9.])/);

  if (legacyMonthMatch) {
    month = legacyMonthMatch[1];
    remaining = remaining.replace(legacyMonthMatch[0], ' ').trim();
  } else if (numMonthMatch) {
    month = numMonthMatch[1];
    remaining = remaining.replace(numMonthMatch[0], ' ').trim();
  } else if (code && /^\d{2}\./.test(code)) {
    month = code.slice(0, 2);
  }

  // 4. Extract Domain
  let domain = '';
  const domainMatch = remaining.match(/\b([pd]\.[a-z0-9.-]+|(?:[a-z0-9-]+\.)+(?:com|mx|net|org|io|vip|app|edu|gob|co|ai|dev|info|biz|us|es|online|site))\b/i);
  if (domainMatch) {
    domain = domainMatch[1];
    remaining = remaining.replace(domainMatch[0], ' ').trim();
  }

  // 5. Extract Tags / Suffixes
  let tags = '';
  const tagMatches = remaining.match(/(?:#[a-z0-9_\-]+|\b(?:jjohn|nneft|nnetf|kkarl|bbria|iisai|aandr|ggena|ssote|aacal|eemma|eedwin|edwin)(?:\d+)?\b)/gi);
  if (tagMatches) {
    tags = tagMatches.join(' ');
    for (const tm of tagMatches) {
      remaining = remaining.replace(tm, ' ');
    }
  }

  // 6. Name is the remaining content (including pipe blocks)
  let name = remaining.replace(/\s+/g, ' ').replace(/^[\s·|—–-]+|[\s·|—–-]+$/g, '').trim();
  if (remaining.trim().startsWith('|')) {
    name = remaining.trim();
  }
  if (!name) name = title;

  return { status, month, code, domain, name, tags, statusPosition };
}

function assembleActivityTitle(parts) {
  const list = [];
  const hasMonthInCode = parts.code && /^\d{2}\./.test(parts.code);
  const codeMonth = hasMonthInCode ? parts.code.slice(0, 2) : '';

  let effectiveCode = parts.code?.trim() || '';
  if (hasMonthInCode && parts.month && parts.month !== codeMonth) {
    effectiveCode = parts.month + effectiveCode.slice(2);
  }

  if (parts.statusPosition === 'before_blocks') {
    if (!hasMonthInCode && parts.month?.trim()) list.push(parts.month.trim());
    if (effectiveCode) list.push(effectiveCode);
    if (parts.domain?.trim()) list.push(parts.domain.trim());
    if (parts.status?.trim()) list.push(parts.status.trim());
    if (parts.name?.trim()) list.push(parts.name.trim());
    if (parts.tags?.trim()) list.push(parts.tags.trim());
  } else {
    if (parts.status?.trim()) list.push(parts.status.trim());
    if (!hasMonthInCode && parts.month?.trim()) list.push(parts.month.trim());
    if (effectiveCode) list.push(effectiveCode);
    if (parts.domain?.trim()) list.push(parts.domain.trim());
    if (parts.name?.trim()) list.push(parts.name.trim());
    if (parts.tags?.trim()) list.push(parts.tags.trim());
  }

  return list.join(' ');
}

const tests = [
  '11.r.01.00 p.dominio.com.cliente aaprtuzS | 💻 rrust | 🗓 Rustdesk | 🌐 #| 🛠 | 💬 | 👥 | ✅ jj-o000 gg-e000 #descripcion #ffase00 #nn-e11 #aa-n11 #ee-d11 #gg-e11 #ii-s11 #jj-o11 #kk-a11',
  'tuzR 11 11.a.01.00 p.anfeta.com Revisión y ajustes de diseño #webs',
  'prtuzREVISION 26-[10OCT] anfeta.com Planeación web neft0000',
  'ed11 11.a.01.00 p.agape Instalación certificado SSL',
  'zCOBRAR 11 p.aldalupe Facturación y cobro mensual',
  'rtuzR 11 ffase37 p.davela.mx Ajuste de formularios'
];

tests.forEach((t, i) => {
  const p = parseActivityTitleParts(t);
  console.log(`\nTest ${i+1}:`);
  console.log('Original:   ', t);
  console.log('Status:     ', p.status, `(pos: ${p.statusPosition})`);
  console.log('Month:      ', p.month);
  console.log('Code:       ', p.code);
  console.log('Domain:     ', p.domain);
  console.log('Name:       ', p.name);
  console.log('Tags:       ', p.tags);
  console.log('Reassembled:', assembleActivityTitle(p));
});
