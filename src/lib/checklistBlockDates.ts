export interface ParsedChecklistBlockDate {
  cleanText: string;
  plannedDate?: string;
  rawMarker?: string;
}

function isValidIsoCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 2020 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * Parses an unambiguous trailing planned-date marker from a Notion to_do block:
 * - Preferred canonical format written by ANFETA: `[YYYY-MM-DD]` (e.g. `Revisar DNS [2026-11-18]`)
 * - Also accepts unambiguous trailing `[YYYY/MM/DD]` or `(YYYY-MM-DD)` written manually in Notion.
 * Does NOT alter dates embedded inside the middle of the sentence or ambiguous `MM/DD` strings.
 */
export function parseChecklistBlockDate(text: string): ParsedChecklistBlockDate {
  const raw = String(text || '');
  const match = raw.match(/\s*(?:\[(\d{4})[-/](\d{1,2})[-/](\d{1,2})\]|\((\d{4})[-/](\d{1,2})[-/](\d{1,2})\))\s*$/);
  if (!match) {
    return { cleanText: raw.trim() };
  }
  const y = Number(match[1] || match[4]);
  const m = Number(match[2] || match[5]);
  const d = Number(match[3] || match[6]);
  if (!isValidIsoCalendarDate(y, m, d)) {
    return { cleanText: raw.trim() };
  }
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const cleanText = raw.slice(0, match.index).replace(/\s+$/, '');
  return {
    cleanText: cleanText || raw.trim(),
    plannedDate: iso,
    rawMarker: match[0],
  };
}

/**
 * Updates or strips the trailing managed `[YYYY-MM-DD]` date marker across Notion `rich_text` runs,
 * preserving rich-text annotations, links, mentions, equations, and legitimate dates in the body.
 */
export function applyChecklistDateToRuns(richTextRuns: readonly any[], plannedDate: string | null): any[] {
  const safeRuns = Array.isArray(richTextRuns) && richTextRuns.length > 0
    ? richTextRuns.map((run) => ({ ...run, ...(run?.text ? { text: { ...run.text } } : {}) }))
    : [{ type: 'text', text: { content: '' } }];

  const validPlanned =
    plannedDate && /^\d{4}-\d{2}-\d{2}$/.test(plannedDate.trim())
      ? (() => {
          const [y, m, d] = plannedDate.trim().split('-').map(Number);
          return isValidIsoCalendarDate(y, m, d) ? plannedDate.trim() : null;
        })()
      : null;

  if (plannedDate && !validPlanned) {
    throw new Error('Fecha inválida para programar el check (usa formato YYYY-MM-DD).');
  }

  // Strip managed trailing date marker from the last editable text run(s)
  let stripped = false;
  for (let i = safeRuns.length - 1; i >= 0; i--) {
    const run = safeRuns[i];
    if (run.type !== 'text') break;
    const content = String(run.text?.content ?? run.plain_text ?? '');
    if (!content.trim() && i > 0) continue;
    const parsed = parseChecklistBlockDate(content);
    if (parsed.rawMarker) {
      const nextContent = content.slice(0, content.length - parsed.rawMarker.length).replace(/\s+$/, '');
      run.text = { ...(run.text || {}), content: nextContent };
      delete run.plain_text;
      stripped = true;
    }
    break;
  }
  void stripped;

  // Clean empty trailing whitespace-only text run left after stripping a separate run marker
  while (safeRuns.length > 1) {
    const tail = safeRuns[safeRuns.length - 1];
    if (tail.type === 'text' && !tail.text?.link && String(tail.text?.content ?? tail.plain_text ?? '').trim() === '') {
      safeRuns.pop();
    } else {
      break;
    }
  }

  if (validPlanned) {
    const suffix = ` [${validPlanned}]`;
    const last = safeRuns[safeRuns.length - 1];
    if (last && last.type === 'text' && !last.text?.link) {
      const prev = String(last.text?.content ?? last.plain_text ?? '').replace(/\s+$/, '');
      last.text = { ...(last.text || {}), content: prev ? `${prev}${suffix}` : `[${validPlanned}]` };
      delete last.plain_text;
    } else {
      safeRuns.push({ type: 'text', text: { content: suffix } });
    }
  }

  return safeRuns.map((run) => {
    if (run.type === 'text') {
      const payload: Record<string, any> = {
        type: 'text',
        text: {
          content: String(run.text?.content ?? run.plain_text ?? ''),
          ...(run.text?.link ? { link: run.text.link } : {}),
        },
      };
      if (run.annotations) payload.annotations = run.annotations;
      return payload;
    }
    return run;
  });
}
