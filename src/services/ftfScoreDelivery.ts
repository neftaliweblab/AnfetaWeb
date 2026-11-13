export interface FtfPublishedScoreEntry {
  person: string;
  date: string;
  finalScore: number;
  stars: number;
  assignedHours?: number;
  completedHours?: number;
  ftfCount?: number;
  ftfBlockCompletedAt?: string;
  attendanceScore?: number;
  agendaScore?: number;
  progressScore?: number;
  closureScore?: number;
}

export interface FtfJournalDeliveryResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  pageId?: string;
  blockId?: string;
  replaced?: boolean;
  pageUrl?: string;
}

export interface FtfEmailDeliveryResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  to?: string[];
  emailId?: string;
}

export function extractNotionPageId(raw: string | undefined | null): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const dashed = value.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (dashed) return dashed[1].toLowerCase();
  const compact = value.match(/([a-f0-9]{32})(?=[?#&/\s]|$)/i) || value.match(/([a-f0-9]{32})/i);
  if (!compact) return '';
  const hex = compact[1].toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function formatMexicoClock(iso: string | undefined): string {
  if (!iso) return 'Sin cierre';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Sin cierre';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

export function formatScoreStars(stars: number): string {
  const clamped = Math.max(0, Math.min(5, Math.round(Number(stars) || 0)));
  return `${'★'.repeat(clamped)}${'☆'.repeat(5 - clamped)} (${clamped}/5)`;
}

export function normalizePublishedEntries(
  rawEntries: Array<Partial<FtfPublishedScoreEntry> & { person?: string }>
): FtfPublishedScoreEntry[] {
  return [...rawEntries]
    .filter((entry) => Boolean(entry?.person && entry.person !== 'Sin asignar'))
    .map((entry) => ({
      person: String(entry.person),
      date: String(entry.date || '').slice(0, 10),
      finalScore: Math.round(Number(entry.finalScore) || 0),
      stars: Math.max(1, Math.min(5, Math.round(Number(entry.stars) || 1))),
      assignedHours: Number(entry.assignedHours) || 0,
      completedHours: Number(entry.completedHours) || 0,
      ftfCount: Number(entry.ftfCount) || 0,
      ftfBlockCompletedAt: entry.ftfBlockCompletedAt || undefined,
      attendanceScore: Number(entry.attendanceScore) || 0,
      agendaScore: Number(entry.agendaScore) || 0,
      progressScore: Number(entry.progressScore) || 0,
      closureScore: Number(entry.closureScore) || 0,
    }))
    .sort((a, b) => b.finalScore - a.finalScore || a.person.localeCompare(b.person));
}

export function buildJournalToggleBlock(
  date: string,
  rawEntries: Array<Partial<FtfPublishedScoreEntry> & { person?: string }>,
  actor: string,
  publishedAt: string
) {
  const entries = normalizePublishedEntries(rawEntries);
  const avg = entries.length
    ? Math.round(entries.reduce((sum, item) => sum + item.finalScore, 0) / entries.length)
    : 0;
  const headerText = `📅 ${date} · Calificaciones FTF (${entries.length} colab · Promedio ${avg}/100 · ${formatMexicoClock(publishedAt)})`;

  const rows = entries.map((entry) => {
    const ftfClock = entry.ftfBlockCompletedAt
      ? `FTF terminado ${formatMexicoClock(entry.ftfBlockCompletedAt)}`
      : 'FTF diario sin palomear';
    const summaryLine = `${entry.person}: ${entry.finalScore}/100 ${formatScoreStars(entry.stars)} · Avance ${entry.completedHours ?? 0}/${entry.assignedHours ?? 0}h · ${entry.ftfCount ?? 0} FTF · ${ftfClock}`;
    return {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ type: 'text', text: { content: summaryLine.slice(0, 1800) } }],
      },
    };
  });

  const metaLine = `Publicado por ${actor} el ${date} a las ${formatMexicoClock(publishedAt)} (America/Mexico_City).`;
  return {
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: [
        {
          type: 'text',
          text: { content: headerText.slice(0, 1800) },
          annotations: { bold: true },
        },
      ],
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: metaLine } }],
          },
        },
        ...rows,
      ].slice(0, 95),
    },
  };
}

export function buildFtfScoreEmailHtml(
  date: string,
  rawEntries: Array<Partial<FtfPublishedScoreEntry> & { person?: string }>,
  actor: string,
  publishedAt: string
): string {
  const entries = normalizePublishedEntries(rawEntries);
  const avg = entries.length
    ? Math.round(entries.reduce((sum, item) => sum + item.finalScore, 0) / entries.length)
    : 0;
  const rowsHtml = entries
    .map((entry) => {
      const ftfText = entry.ftfBlockCompletedAt
        ? `✓ ${formatMexicoClock(entry.ftfBlockCompletedAt)}`
        : 'Sin marcar';
      const badgeColor =
        entry.finalScore >= 85 ? '#10b981' : entry.finalScore >= 70 ? '#f59e0b' : '#f43f5e';
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;font-weight:600;color:#f8fafc;">${escapeHtml(entry.person)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;font-weight:700;color:${badgeColor};">${entry.finalScore}/100</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#fde68a;">${escapeHtml(formatScoreStars(entry.stars))}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1;">${entry.completedHours ?? 0}h / ${entry.assignedHours ?? 0}h</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#a5f3fc;">${escapeHtml(ftfText)}</td>
        </tr>`;
    })
    .join('');

  return `
  <div style="background:#0b111a;color:#e2e8f0;font-family:Segoe UI,Arial,sans-serif;padding:24px;border-radius:12px;">
    <h2 style="margin:0 0 6px 0;color:#38bdf8;">📊 Corte Diario FTF ANFETA · ${escapeHtml(date)}</h2>
    <p style="margin:0 0 16px 0;font-size:13px;color:#94a3b8;">
      Publicado por <strong>${escapeHtml(actor)}</strong> a las <strong>${escapeHtml(formatMexicoClock(publishedAt))}</strong> · Promedio del equipo: <strong>${avg}/100</strong>
    </p>
    <table style="width:100%;border-collapse:collapse;background:#111827;border:1px solid #1e293b;border-radius:8px;overflow:hidden;font-size:13px;">
      <thead>
        <tr style="background:#162032;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;">
          <th style="padding:10px 12px;">Colaborador</th>
          <th style="padding:10px 12px;">Puntaje</th>
          <th style="padding:10px 12px;">Estrellas</th>
          <th style="padding:10px 12px;">Horas (Comp./Asig.)</th>
          <th style="padding:10px 12px;">FTF Diario</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>`;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function appendDailyFtfJournalToggle(params: {
  notionToken?: string;
  journalPageId?: string;
  date: string;
  entries: Array<Partial<FtfPublishedScoreEntry> & { person?: string }>;
  actor: string;
  publishedAt: string;
}): Promise<FtfJournalDeliveryResult> {
  const token = String(params.notionToken || '').trim();
  const pageId = extractNotionPageId(params.journalPageId);
  if (!token) {
    return { ok: false, skipped: true, reason: 'Falta token de Notion (NOTION_TOKEN).' };
  }
  if (!pageId) {
    return {
      ok: false,
      skipped: true,
      reason: 'Falta ID/URL de página Journal en Ajustes (NOTION_FTF_JOURNAL_PAGE_ID).',
    };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  let replaced = false;
  try {
    const listRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`, {
      headers,
      signal: AbortSignal.timeout(12000),
    });
    if (listRes.ok) {
      const listData = await listRes.json().catch(() => null);
      const dayPrefix = `📅 ${params.date}`;
      type NotionRichTextChunk = { plain_text?: string; text?: { content?: string } };
      type NotionToggleBlockItem = { id?: string; type?: string; toggle?: { rich_text?: NotionRichTextChunk[] } };
      const resultsList: NotionToggleBlockItem[] = Array.isArray(listData?.results) ? listData.results : [];
      const previousSameDay = resultsList.filter((b) => {
        if (b?.type !== 'toggle') return false;
        const txt = (b.toggle?.rich_text || [])
          .map((t) => t?.plain_text || t?.text?.content || '')
          .join('');
        return txt.startsWith(dayPrefix);
      });
      for (const oldBlock of previousSameDay) {
        if (!oldBlock?.id) continue;
        const delRes = await fetch(`https://api.notion.com/v1/blocks/${oldBlock.id}`, {
          method: 'DELETE',
          headers,
          signal: AbortSignal.timeout(8000),
        });
        if (delRes.ok) replaced = true;
      }
    }
  } catch {
    // Si falla la limpieza previa, igualmente agregamos el toggle actualizado
  }

  const toggleBlock = buildJournalToggleBlock(params.date, params.entries, params.actor, params.publishedAt);
  const appendRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ children: [toggleBlock] }),
    signal: AbortSignal.timeout(15000),
  });
  const appendData = await appendRes.json().catch(() => null);
  if (!appendRes.ok) {
    return {
      ok: false,
      pageId,
      reason: appendData?.message || `Notion respondió HTTP ${appendRes.status}`,
    };
  }
  const blockId = appendData?.results?.[0]?.id;
  return {
    ok: true,
    pageId,
    blockId,
    replaced,
    pageUrl: `https://www.notion.so/${pageId.replace(/-/g, '')}`,
  };
}

export async function sendFtfScoreEmail(params: {
  apiKey?: string;
  from?: string;
  to?: string;
  date: string;
  entries: Array<Partial<FtfPublishedScoreEntry> & { person?: string }>;
  actor: string;
  publishedAt: string;
}): Promise<FtfEmailDeliveryResult> {
  const apiKey = String(params.apiKey || '').trim();
  const recipients = String(params.to || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));

  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'Falta RESEND_API_KEY en Ajustes o variables de entorno.' };
  }
  if (recipients.length === 0) {
    return {
      ok: false,
      skipped: true,
      reason: 'Falta correo destino de John (FTF_REPORT_EMAIL_TO) en Ajustes.',
    };
  }

  const from = String(params.from || '').trim() || 'ANFETA FTF <onboarding@resend.dev>';
  const html = buildFtfScoreEmailHtml(params.date, params.entries, params.actor, params.publishedAt);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `📊 Corte Diario FTF ANFETA · ${params.date}`,
      html,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      to: recipients,
      reason: data?.message || data?.error || `Resend respondió HTTP ${res.status}`,
    };
  }

  return {
    ok: true,
    to: recipients,
    emailId: data?.id,
  };
}
