"use client";

import {useEffect, useState} from 'react';
import {readApiJson} from '@/lib/readApiJson';
import {calendarTime, mexicoDate} from '@/services/calendarPresentation';
import {buildFtfWeek, ftfWeekStart, shiftFtfDate} from '@/services/ftfDashboard';

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
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setError('');
    void (async () => {
      try {
        const response = await fetch('/api/data?type=ftf-dashboard&scope=week&date=' + encodeURIComponent(week), {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
        });
        const data = await readApiJson(response);
        if (!controller.signal.aborted) setReport(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la semana.');
      }
    })();
    return () => controller.abort();
  }, [week, attempt]);

  const names = [...new Set(report?.days.flatMap(day => day.people.map(row => row.name)) ?? [])];
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
        <p className="mt-2 font-semibold text-cyan-200">{report.start} al {report.end} · {ftfHours(pending)} por asignar {person ? 'para ' + person : 'en el equipo'}</p>
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
      </>}
    </section>
  );
}
