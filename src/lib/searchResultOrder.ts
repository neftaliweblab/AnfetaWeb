function parseDateCandidate(raw: any): number {
  if (!raw) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const str = String(raw).trim();
  if (!str) return 0;
  const direct = Date.parse(str);
  if (Number.isFinite(direct)) return direct;
  const isoMatch = str.match(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[+-]\d{2}:?\d{2}|Z)?)?/);
  if (isoMatch) {
    const t = Date.parse(isoMatch[0].replace(' ', 'T'));
    if (Number.isFinite(t)) return t;
  }
  const dmyMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const t = Date.parse(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

export function newestFirst(a: any, b: any) {
  const time = (row: any) => {
    if (!row) return 0;
    let best = 0;
    const candidates = [
      row.scheduledDate,
      row.serverModified,
      row.modifiedLocalDate,
      row.notionEditedUtc,
      row.dateStart,
      row.date,
      row.lastEdited,
      row.Start
    ];
    for (const val of candidates) {
      const t = parseDateCandidate(val);
      if (t > best) best = t;
    }
    return best;
  };
  const diff = time(b) - time(a);
  if (diff !== 0) return diff;
  return (a.name || '').localeCompare(b.name || '');
}

