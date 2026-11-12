"use client";

import {useEffect, useState} from 'react';
import {readApiJson} from '@/lib/readApiJson';
import {calendarTime, mexicoDate} from '@/services/calendarPresentation';
import {buildFtfWeek, ftfWeekStart, shiftFtfDate} from '@/services/ftfDashboard';
import {buildWeeklyPayrollMatrix, computeHybridFtfScore, SavedFtfScoreEntry, starWeight} from '@/services/ftfScoring';

type WeekReport = ReturnType<typeof buildFtfWeek> & {warning?: string};

export function ftfHours(minutes: number) {
  return Math.floor(minutes / 60) + ' h' + (minutes % 60 ? ' ' + minutes % 60 + ' min' : '');
}

export function CalendarFtfWeek({date}: {date: string}) {
  const today = mexicoDate();
  const currentWeek = ftfWeekStart(today);
  const [week, setWeek] = useState(() => ftfWeekStart(date > today ? today : date));
  const [person, setPerson] = useState('');
  const [report, setReport] = useState<WeekReport | null>(null);
  const [scoresByDate, setScoresByDate] = useState<Record<string, Record<string, SavedFtfScoreEntry>>>({});
  const [viewMode, setViewMode] = useState<'matrix' | 'detail'>('matrix');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setError('');
    const weekDates = [0, 1, 2, 3, 4].map(offset => shiftFtfDate(week, offset));
    void (async () => {
      try {
        const [dashRes, scoreRes] = await Promise.all([
          fetch('/api/data?type=ftf-dashboard&scope=week&date=' + encodeURIComponent(week), {
            cache: 'no-store',
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
          }),
          fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-ftf-scores', payload: { dates: weekDates } }),
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
          }).catch(() => null),
        ]);
        const data = await readApiJson(dashRes);
        const sData = scoreRes && scoreRes.ok ? await scoreRes.json().catch(() => null) : null;
        if (!controller.signal.aborted) {
          setReport(data);
          if (sData?.success && sData.scoresByDate) {
            setScoresByDate(sData.scoresByDate);
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la semana.');
      }
    })();
    return () => controller.abort();
  }, [week, attempt]);

  const names = [...new Set(report?.days.flatMap(day => day.people.map(row => row.name)) ?? [])];
  const filteredNames = person ? names.filter(n => n === person) : names;
  const weekDatesMonToFri = [0, 1, 2, 3, 4].map(offset => shiftFtfDate(week, offset));
  // Combinar puntajes guardados con estimación en vivo de días ya transcurridos
  const mergedScoresByDate: Record<string, Record<string, SavedFtfScoreEntry>> = { ...scoresByDate };
  if (report) {
    for (const dayEntry of report.days) {
      if (!weekDatesMonToFri.includes(dayEntry.day) || dayEntry.day > today) continue;
      const existingDay = { ...(mergedScoresByDate[dayEntry.day] || {}) };
      for (const p of dayEntry.people) {
        if (!existingDay[p.name] && p.workdayHours !== null) {
          const hasAnySignal = Boolean(p.firstSeen || p.lastSeen || (p.completedMinutes || 0) > 0 || p.total > 0);
          if (hasAnySignal) {
            existingDay[p.name] = computeHybridFtfScore(
              {
                name: p.name,
                assignedHours: Number(((p.ftfVerifiedMinutes || 0) / 60 || 0).toFixed(1)) || (p.total > 0 ? 8 : 0),
                completedHours: Number(((p.completedMinutes || 0) / 60).toFixed(1)),
                verified: p.verified,
                total: p.total,
                ftfPendingAssignmentMinutes: p.pendingAssignmentMinutes ?? 0,
                status: p.pendingAssignmentMinutes === 0 && p.verified === p.total && p.total > 0 ? 'complete' : p.total > 0 ? 'pending' : 'empty',
                firstSignalAt: p.firstSeen,
                lastSignalAt: p.lastSeen,
              },
              dayEntry.day
            );
          }
        }
      }
      mergedScoresByDate[dayEntry.day] = existingDay;
    }
  }
  const payrollMatrix = buildWeeklyPayrollMatrix(weekDatesMonToFri, filteredNames, mergedScoresByDate);
  const rows = report?.days.flatMap(day => day.people
    .filter(row => !person || row.name === person)
    .map(row => ({...row, day: day.day}))) ?? [];
  const pending = rows.reduce((sum, row) => sum + (row.pendingAssignmentMinutes ?? 0), 0);

  return (
    <section aria-label="Historial semanal de la bitácora" className="mt-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded border border-slate-600 px-2 py-1" onClick={() => setWeek(value => shiftFtfDate(value, -7))}>Semana anterior</button>
        <button type="button" disabled={week >= currentWeek} className="rounded border border-slate-600 px-2 py-1 disabled:opacity-40" onClick={() => setWeek(value => shiftFtfDate(value, 7))}>Semana siguiente</button>
        <button type="button" className="rounded border border-slate-600 px-2 py-1" onClick={() => setWeek(currentWeek)}>Semana actual</button>
        <label className="flex items-center gap-1">
          Ir a semana
          <input type="date" value={week} max={today} onChange={event => {if (event.target.value && event.target.value <= today) setWeek(ftfWeekStart(event.target.value));}} className="rounded border border-slate-600 bg-slate-900 px-2 py-1" />
        </label>
        <label className="flex items-center gap-1">
          Integrante
          <select value={person} onChange={event => setPerson(event.target.value)} className="rounded border border-slate-600 bg-slate-900 px-2 py-1">
            <option value="">Todo el equipo</option>
            {names.map(name => <option key={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-2 text-slate-400">Hora de Ciudad de México. Última señal es el último registro de presencia. Jornada base: 8.0 h · Meta productiva: 6.5 h. Fechas anteriores sin registro de cortes de asignación muestran «Sin evidencia».</p>
      {error && <div role="alert" className="mt-2 text-rose-300">{error} <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
      {!report && !error && <p role="status" className="mt-2 text-slate-400">Cargando semana…</p>}
      {report?.warning && <p role="status" className="mt-2 text-amber-300">{report.warning}</p>}
      {report && <>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-cyan-200">{report.start} al {report.end} · {ftfHours(pending)} por asignar {person ? 'para ' + person : 'en el equipo'}</p>
          <div className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold cursor-pointer ${viewMode === 'matrix' ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-400/60' : 'text-slate-400 hover:text-white'}`}
            >
              Matriz Semanal (Pagos Viernes)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detail')}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold cursor-pointer ${viewMode === 'detail' ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-400/60' : 'text-slate-400 hover:text-white'}`}
            >
              Detalle Diario FTF
            </button>
          </div>
        </div>

        {viewMode === 'matrix' ? (
          <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[740px] text-left">
              <thead className="sticky top-0 bg-slate-900 text-slate-300">
                <tr>
                  <th scope="col" className="px-2.5 py-2">Integrante</th>
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((lbl, idx) => (
                    <th scope="col" key={lbl} className="px-2 py-2 text-center">
                      <span>{lbl}</span>
                      <span className="block text-[9px] font-normal text-slate-400 font-mono">{weekDatesMonToFri[idx]?.slice(5)}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-2.5 py-2 text-center">Promedio</th>
                  <th scope="col" className="px-2 py-2 text-center">Faltas</th>
                  <th scope="col" className="px-2 py-2 text-center">Extra Bono</th>
                  <th scope="col" className="px-2.5 py-2">Estatus Nómina</th>
                </tr>
              </thead>
              <tbody>
                {payrollMatrix.map(row => {
                  const statusClass =
                    row.payrollStatus === 'Bono / Excelente'
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/60'
                      : row.payrollStatus === 'Revisar / Atención'
                      ? 'bg-rose-500/20 text-rose-200 border-rose-400/60'
                      : 'bg-cyan-500/15 text-cyan-200 border-cyan-500/50';
                  return (
                    <tr key={row.person} className="border-t border-slate-800/90 hover:bg-slate-900/40">
                      <td className="px-2.5 py-2 font-semibold text-slate-100">{row.person}</td>
                      {row.days.map(d => (
                        <td key={d.date} className="px-2 py-1.5 text-center font-mono">
                          {d.absent ? (
                            <span className="inline-block rounded bg-rose-950/80 border border-rose-500/60 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                              Falta 0
                            </span>
                          ) : d.score === null ? (
                            <span className="text-slate-600">—</span>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold border ${
                                  d.score >= 85
                                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50'
                                    : d.score >= 50
                                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                                    : 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                                }`}
                              >
                                {d.score}
                              </span>
                              <span
                                className="text-[9px] text-amber-300 mt-0.5"
                                title="★ = 100% · ◐ = ½ estrella (parcial) · ☆ = 0%"
                              >
                                {d.stars.map(s => {
                                  const w = starWeight(s);
                                  return w >= 0.99 ? '★' : w >= 0.25 ? '◐' : '☆';
                                }).join('')}
                              </span>
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="px-2.5 py-2 text-center font-mono font-bold text-sm text-cyan-200">
                        {row.weeklyAverage} <span className="text-[10px] text-slate-400">/100</span>
                      </td>
                      <td className="px-2 py-2 text-center font-mono">
                        {row.absences > 0 ? <span className="text-rose-300 font-bold">{row.absences}</span> : <span className="text-slate-500">0</span>}
                      </td>
                      <td className="px-2 py-2 text-center font-mono">
                        {row.overtimeTotalHours > 0 ? (
                          <span className="rounded bg-violet-950/80 border border-violet-500/60 px-1.5 py-0.5 text-[10px] text-violet-200">
                            +{row.overtimeTotalHours}h
                          </span>
                        ) : (
                          <span className="text-slate-500">0h</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${statusClass}`}>
                          {row.payrollStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!payrollMatrix.length && <p className="p-2 text-slate-400">Sin registros semanales para esta selección.</p>}
          </div>
        ) : (
          <div className="mt-2 max-h-72 overflow-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="sticky top-0 bg-slate-900 text-slate-300">
                <tr>{['Día', 'Integrante', 'Primera conexión', 'Última señal', 'Agenda 10:00', 'Registro FTF', 'Checks', 'Por asignar', 'Horas FTF', 'Horas terminadas'].map(label => <th scope="col" key={label} className="px-2 py-1.5">{label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(row => <tr key={row.day + ':' + row.name} className="border-t border-slate-800">
                  <td className="whitespace-nowrap px-2 py-1.5">{row.day}</td>
                  <td className="px-2 py-1.5 font-medium text-slate-200">{row.name}</td>
                  <td className="px-2 py-1.5">{row.firstSeen ? calendarTime(row.firstSeen) : 'Sin registro'}</td>
                  <td className="px-2 py-1.5">{row.lastSeen ? calendarTime(row.lastSeen) : 'Sin registro'}</td>
                  <td className="px-2 py-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      row.agenda10Status === 'Lista para 10:00'
                        ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60'
                        : row.agenda10Status === 'Sin evidencia'
                        ? 'bg-slate-800/60 text-slate-400 border border-slate-700'
                        : 'bg-amber-950/60 text-amber-300 border border-amber-700/60'
                    }`}>
                      {row.agenda10Status || 'Sin evidencia'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">{row.recordedAt ? calendarTime(row.recordedAt) + (row.timeKind === 'confirmed' ? ' · Confirmado' : ' · Observado') : 'Sin registro'}</td>
                  <td className="px-2 py-1.5 font-mono">{row.verified}/{row.total}</td>
                  <td className="px-2 py-1.5">{row.pendingAssignmentMinutes === null ? 'Sin jornada' : ftfHours(row.pendingAssignmentMinutes)}</td>
                  <td className="px-2 py-1.5 text-cyan-300 font-mono">{ftfHours(row.ftfVerifiedMinutes || 0)}</td>
                  <td className="px-2 py-1.5 text-emerald-300 font-mono">{ftfHours(row.completedMinutes || 0)}</td>
                </tr>)}
              </tbody>
            </table>
            {!rows.length && <p className="p-2 text-slate-400">Sin registros para esta selección.</p>}
          </div>
        )}
      </>}
    </section>
  );
}
