import { NotionCalendarActivity } from '@/types/anfeta';
import { computeDailyKPIs, evaluateLagStatus, getForecastStatus } from '@/services/progressKpis';
import { normalizePerson, getPersonColor } from '@/services/identityNormalizer';
import { workflowState } from '@/services/activityWorkflow';

export function reportHtml(
  activities: NotionCalendarActivity[],
  date: string,
  scope: string,
  selectedPerson?: string | null
) {
  const escape = (s: string) =>
    (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  const filtered = selectedPerson
    ? activities.filter((a) => normalizePerson(a.person) === selectedPerson)
    : activities;

  const kpis = computeDailyKPIs(filtered, date);

  // Agrupar actividades por colaborador
  const peopleMap = new Map<string, NotionCalendarActivity[]>();
  for (const act of filtered) {
    const p = normalizePerson(act.person);
    if (!peopleMap.has(p)) peopleMap.set(p, []);
    peopleMap.get(p)!.push(act);
  }

  // Generar tarjetas de colaboradores
  let peopleHtml = '';
  for (const [personName, acts] of Array.from(peopleMap.entries()).sort()) {
    const personColor = getPersonColor(personName);
    const personKpis = computeDailyKPIs(acts, date);

    let rowsHtml = '';
    for (const act of acts) {
      const lag = evaluateLagStatus(act);
      const forecast = getForecastStatus(act);
      const st = workflowState(act.status, act.title);

      const statusBadge =
        st === 'completed' || act.isFinalized
          ? '<span class="badge badge-done">✅ FINALIZADA</span>'
          : st === 'review' || act.isCompletedForReview
          ? '<span class="badge badge-review">🔍 EN REVISIÓN</span>'
          : lag.isLagging
          ? '<span class="badge badge-lag">🚨 REZAGO</span>'
          : '<span class="badge badge-pending">⏳ PENDIENTE</span>';

      const pct =
        act.checklistTotal > 0
          ? Math.round((act.todayChecklistCompleted / act.checklistTotal) * 100)
          : act.isFinalized
          ? 100
          : 0;

      // Desglose de checks si existen
      let checksBreakdown = '';
      if (act.completedChecks && act.completedChecks.length > 0) {
        checksBreakdown = `
          <div class="checks-list">
            ${act.completedChecks
              .map(
                (c) =>
                  `<div class="check-item ${c.isChecked ? 'check-done' : ''}">
                    <span class="check-box">${c.isChecked ? '☑' : '☐'}</span>
                    <span class="check-text">${escape(c.text)}</span>
                    ${c.editedAt ? `<span class="check-time">${escape(c.editedAt.slice(11, 16))}</span>` : ''}
                  </div>`
              )
              .join('')}
          </div>
        `;
      }

      rowsHtml += `
        <div class="activity-card ${lag.isLagging ? 'card-lagging' : ''}">
          <div class="activity-header">
            <div class="domain-title">
              <span class="domain-tag">${escape(act.domain || 'DOMINIO')}</span>
              <span class="activity-title">${escape(act.shortTitle || act.title)}</span>
            </div>
            <div class="badges-row">
              ${statusBadge}
              <span class="forecast-tag">${escape(forecast)}</span>
            </div>
          </div>
          
          <div class="activity-body">
            <div class="meta-row">
              <span>🕒 Horario: <strong>${escape(act.start?.slice(11, 16) || '—')} – ${escape(act.end?.slice(11, 16) || '—')}</strong></span>
              <span>📋 Checks: <strong>${act.todayChecklistCompleted} / ${act.checklistTotal}</strong> (${pct}%)</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${pct}%"></div>
            </div>
            ${checksBreakdown}
          </div>
        </div>
      `;
    }

    peopleHtml += `
      <section class="person-section">
        <div class="person-header" style="border-left: 5px solid ${personColor};">
          <div class="person-identity">
            <span class="avatar-circle" style="background: ${personColor}33; color: ${personColor}; border: 1px solid ${personColor}88;">
              ${escape(personName.slice(0, 1).toUpperCase())}
            </span>
            <div>
              <h2 class="person-name">${escape(personName.toUpperCase())}</h2>
              <span class="person-stats">${acts.length} actividades · Avance: ${personKpis.progressMinutes} min / ${personKpis.scheduledMinutes} min programados</span>
            </div>
          </div>
          <div class="person-kpis">
            <div class="metric-pill">
              <span class="metric-lbl">Cobertura</span>
              <span class="metric-val" style="color: ${personColor};">${personKpis.coveragePercentage}%</span>
            </div>
            <div class="metric-pill">
              <span class="metric-lbl">Rezagos</span>
              <span class="metric-val" style="color: ${personKpis.laggingCount > 0 ? '#FB7185' : '#94A3B8'};">${personKpis.laggingCount}</span>
            </div>
            <div class="metric-pill">
              <span class="metric-lbl">Revisión</span>
              <span class="metric-val" style="color: #38BDF8;">${personKpis.reviewCount}</span>
            </div>
            <div class="metric-pill">
              <span class="metric-lbl">Finalizadas</span>
              <span class="metric-val" style="color: #4ADE80;">${personKpis.completedCount}</span>
            </div>
          </div>
        </div>
        <div class="activities-container">
          ${rowsHtml}
        </div>
      </section>
    `;
  }

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Reporte Ejecutivo de Avance Diario ANFETA · ${escape(date)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg: #080B0F;
      --card-bg: #0F141A;
      --surface: #141B24;
      --border: #223242;
      --text: #F1F5F9;
      --muted: #94A3B8;
      --accent: #38BDF8;
      --green: #4ADE80;
      --rose: #FB7185;
      --amber: #FBBF24;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 32px;
      line-height: 1.5;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    header.main-header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: gap;
    }
    h1.title {
      font-size: 24px;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge-scope {
      background: #0284C7/20;
      color: var(--accent);
      border: 1px solid #0284C7/40;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      font-family: monospace;
    }
    .subtitle { color: var(--muted); font-size: 13px; margin-top: 4px; }
    
    .print-btn {
      background: #0284C7;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 0 12px rgba(2,132,199,0.3);
    }
    
    /* Grid de KPIs Globales */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .kpi-card.kpi-accent { border-color: #0284C7/60; background: #0B1E2E; }
    .kpi-card.kpi-danger { border-color: #FB7185/40; background: #2B1419; }
    .kpi-card.kpi-success { border-color: #4ADE80/40; background: #10251B; }
    .kpi-label { font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 700; letter-spacing: 0.5px; }
    .kpi-val { font-size: 26px; font-weight: 800; font-family: monospace; margin: 4px 0; color: var(--text); }
    .kpi-sub { font-size: 11px; color: var(--muted); }
    
    /* Secciones por persona */
    .person-section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    .person-header {
      background: #0D131B;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      border-bottom: 1px solid var(--border);
    }
    .person-identity { display: flex; align-items: center; gap: 12px; }
    .avatar-circle {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 15px;
    }
    .person-name { font-size: 16px; font-weight: 700; color: var(--text); }
    .person-stats { font-size: 11px; color: var(--muted); font-family: monospace; }
    .person-kpis { display: flex; gap: 8px; flex-wrap: wrap; }
    .metric-pill {
      background: #141C28;
      border: 1px solid #1E2B3C;
      border-radius: 8px;
      padding: 4px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 60px;
    }
    .metric-lbl { font-size: 9px; color: var(--muted); text-transform: uppercase; }
    .metric-val { font-size: 13px; font-weight: 700; font-family: monospace; }
    
    /* Actividades */
    .activities-container { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .activity-card {
      background: #111721;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px;
    }
    .activity-card.card-lagging {
      background: #1F1015;
      border-color: #FB7185/60;
    }
    .activity-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
    .domain-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .domain-tag {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      color: var(--accent);
      background: #0B2538;
      border: 1px solid #0284C7/50;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .activity-title { font-size: 13px; font-weight: 600; color: var(--text); }
    .badges-row { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .badge {
      font-size: 9.5px;
      font-weight: 700;
      font-family: monospace;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .badge-done { background: #143322; color: #4ADE80; border: 1px solid #4ADE80/40; }
    .badge-review { background: #0B293F; color: #38BDF8; border: 1px solid #38BDF8/40; }
    .badge-lag { background: #38131B; color: #FB7185; border: 1px solid #FB7185/50; }
    .badge-pending { background: #1A2433; color: #94A3B8; border: 1px solid #2B3D55; }
    .forecast-tag {
      font-size: 10px;
      color: var(--muted);
      font-family: monospace;
      background: #141A24;
      padding: 3px 6px;
      border-radius: 4px;
    }
    
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 6px;
      font-family: monospace;
    }
    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background: #1A2330;
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--green));
    }
    
    /* Checklist desglose */
    .checks-list {
      background: #0B0E14;
      border: 1px solid #1C2634;
      border-radius: 8px;
      padding: 8px 12px;
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .check-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--muted);
    }
    .check-item.check-done { color: #E2E8F0; }
    .check-box { font-size: 13px; color: var(--accent); }
    .check-item.check-done .check-box { color: var(--green); }
    .check-text { flex: 1; }
    .check-time { font-family: monospace; font-size: 9.5px; color: #64748B; }

    footer.doc-footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 11px;
      color: #64748B;
    }

    @media print {
      body { background: white; color: #0F172A; padding: 0; }
      .print-btn { display: none; }
      .kpi-card, .person-section, .activity-card {
        background: #F8FAFC !important;
        border-color: #CBD5E1 !important;
        color: #0F172A !important;
        break-inside: avoid;
      }
      .kpi-val, .person-name, .activity-title { color: #0F172A !important; }
      .progress-bar-bg { background: #E2E8F0 !important; }
      .checks-list { background: #F1F5F9 !important; border-color: #CBD5E1 !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="main-header">
      <div>
        <h1 class="title">
          <span>📊 Reporte Ejecutivo de Avance Diario</span>
          <span class="badge-scope">${escape(scope === 'week' ? 'Semana' : 'Día')} · ${escape(date)}</span>
        </h1>
        <p class="subtitle">ANFETA Intelligence · Ventana ejecutiva 09:30–18:00 · Filtro: ${escape(selectedPerson || 'Equipo Completo')}</p>
      </div>
      <button class="print-btn" onclick="window.print()">🖨️ Guardar PDF / Imprimir</button>
    </header>

    <!-- KPIs Generales -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-accent">
        <div class="kpi-label">Cobertura Ponderada</div>
        <div class="kpi-val">${kpis.coveragePercentage}%</div>
        <div class="kpi-sub">${kpis.progressMinutes} / ${kpis.scheduledMinutes} min</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Actividades</div>
        <div class="kpi-val">${kpis.totalActivities}</div>
        <div class="kpi-sub">Actual: ${kpis.currentProgressPercentage ?? 0}%</div>
      </div>
      <div class="kpi-card ${kpis.laggingCount > 0 ? 'kpi-danger' : ''}">
        <div class="kpi-label">Rezagos Detectados</div>
        <div class="kpi-val" style="${kpis.laggingCount > 0 ? 'color:#FB7185;' : ''}">${kpis.laggingCount}</div>
        <div class="kpi-sub">&lt;33% tras hora límite</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">En Revisión</div>
        <div class="kpi-val" style="color:#38BDF8;">${kpis.reviewCount}</div>
        <div class="kpi-sub">rtuzREVISION</div>
      </div>
      <div class="kpi-card kpi-success">
        <div class="kpi-label">Finalizadas</div>
        <div class="kpi-val" style="color:#4ADE80;">${kpis.completedCount}</div>
        <div class="kpi-sub">zREVISION</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Sin Checklist</div>
        <div class="kpi-val" style="color:#F59E0B;">${kpis.missingChecklistCount}</div>
        <div class="kpi-sub">Dato no computable</div>
      </div>
    </div>

    <!-- Desglose por Colaborador -->
    ${peopleHtml || '<div style="text-align:center; padding:40px; color:#64748B;">No hay actividades registradas en este periodo.</div>'}

    <footer class="doc-footer">
      Generado automáticamente por ANFETA Web · Con Supabase, el avance usa marcados web registrados; los externos sin fecha se indican como desconocidos.
    </footer>
  </div>
</body>
</html>`;
}

export function downloadProgressHtml(html: string, date: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `avance-anfeta-${date}.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printProgressHtml(html: string) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Permite abrir la ventana emergente para imprimir el reporte.');
  popup.opener = null;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
}
