function parseActivityTitleParts(rawTitle) {
  const title = (rawTitle || '').trim();
  let remaining = title;

  // 1. Extract status / prefix
  let status = '';
  const statusMatch = remaining.match(/^(?:\[([^\]]+)\]\s*)?(sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION|sprtuz|aprtuz|prtuz|rtuz|tuzR|rtuzR|zCOBRAR|zPAGAR|eed11|ed11|nne11|bbria)\b/i);
  if (statusMatch) {
    status = statusMatch[1] || statusMatch[0];
    remaining = remaining.replace(statusMatch[0], '').trim();
  }

  // 2. Extract Code / Phase / Order first (to prevent sub-parts being treated as isolated months)
  let code = '';
  const codeMatch = remaining.match(/(?<![a-z0-9])(\d{1,2}\.[a-z0-9.]+|ffase\d+|fase\d+|0\d\.\d{2})(?![a-z0-9])/i);
  if (codeMatch) {
    code = codeMatch[1];
    remaining = remaining.replace(codeMatch[0], '').trim();
  }

  // 3. Extract Month (from legacy tag, standalone 2-digit number, or extracted from code if missing)
  let month = '';
  const legacyMonthMatch = remaining.match(/(?:\d{2}-)?\[?(\d{2})[A-ZÁÉÍÓÚ]{3,4}\]?/i);
  if (legacyMonthMatch) {
    month = legacyMonthMatch[1];
    remaining = remaining.replace(legacyMonthMatch[0], '').trim();
  } else {
    // Only match standalone 2-digit number not followed or preceded by dots
    const numMonthMatch = remaining.match(/(?<![a-z0-9.])(0[1-9]|1[0-2])(?![a-z0-9.])/);
    if (numMonthMatch) {
      month = numMonthMatch[1];
      remaining = remaining.replace(numMonthMatch[0], '').trim();
    } else if (code && /^\d{2}\./.test(code)) {
      // If code is 11.a.01.00, month is implicitly 11
      month = code.slice(0, 2);
    }
  }

  // 4. Extract Domain
  let domain = '';
  const domainMatch = remaining.match(/\b([pd]\.[a-z0-9.-]+|(?:[a-z0-9-]+\.)+(?:com|mx|net|org|io|vip|app|edu|gob|co|ai|dev|info|biz|us|es|online|site))\b/i);
  if (domainMatch) {
    domain = domainMatch[1];
    remaining = remaining.replace(domainMatch[0], '').trim();
  }

  // 5. Extract Tags / Suffixes
  let tags = '';
  const tagMatches = remaining.match(/(?:#[a-z0-9_\-]+|\b(?:jjohn|nneft|nnetf|kkarl|bbria|iisai|aandr|ggena|ssote|aacal|eemma|eedwin|edwin)(?:\d+)?\b)/gi);
  if (tagMatches) {
    tags = tagMatches.join(' ');
    for (const tm of tagMatches) {
      remaining = remaining.replace(tm, '');
    }
  }

  // 6. Whatever is left is the Name / Description
  let name = remaining.replace(/\s+/g, ' ').replace(/^[\s·|—–-]+|[\s·|—–-]+$/g, '').trim();
  if (!name) name = title;

  return { status, month, code, domain, name, tags };
}

function assembleActivityTitle(parts) {
  const list = [];
  if (parts.status?.trim()) list.push(parts.status.trim());
  if (parts.month?.trim()) list.push(parts.month.trim());
  if (parts.code?.trim()) list.push(parts.code.trim());
  if (parts.domain?.trim()) list.push(parts.domain.trim());
  if (parts.name?.trim()) list.push(parts.name.trim());
  if (parts.tags?.trim()) list.push(parts.tags.trim());
  return list.join(' ');
}

const tests = [
  'tuzR 11 11.a.01.00 p.anfeta.com Revisión y ajustes de diseño #webs',
  'prtuzREVISION 26-[10OCT] anfeta.com Planeación web neft0000',
  'ed11 11.a.01.00 p.agape Instalación certificado SSL',
  'zCOBRAR 11 p.aldalupe Facturación y cobro mensual',
  'rtuzR 11 ffase37 p.davela.mx Ajuste de formularios'
];

tests.forEach(t => {
  const p = parseActivityTitleParts(t);
  console.log('Original:    ', t);
  console.log('Parsed:      ', JSON.stringify(p));
  console.log('Reassembled: ', assembleActivityTitle(p));
  console.log('---');
});
