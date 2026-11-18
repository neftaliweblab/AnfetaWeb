"use client";
import React, { useState } from 'react';
import { mexicoDate } from '@/services/calendarPresentation';
import { shiftMexicoDay } from '@/lib/dailyChecklist';

export function ActivityQuickEntry({
  pageId,
  disabled,
  workDate,
  onChecklistAdded,
}: {
  pageId: string;
  disabled: boolean;
  workDate?: string;
  onChecklistAdded: (item: any) => void;
}) {
  const [text, setText] = useState('');
  const [highlight, setHighlight] = useState(true);
  const [plannedDate, setPlannedDate] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [feed, setFeed] = useState<{ id: string; text: string; pending: boolean; comment: boolean; plannedDate?: string }[]>([]);

  const today = workDate || mexicoDate();
  const tomorrow = shiftMexicoDay(today, 1);

  async function add(comment: boolean) {
    if (busy || disabled || !text.trim()) return;
    const effectivePlanned = !comment && plannedDate ? plannedDate : undefined;
    const draft = {
      id: crypto.randomUUID(),
      text: (highlight ? '⚡ ' : '') + text.trim(),
      pending: true,
      comment,
      plannedDate: effectivePlanned,
    };
    setFeed((old) => [...old, draft]);
    setBusy(true);
    setStatus('Cargando…');
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: comment ? 'add-comment' : 'add-checklist-item',
          payload: { pageId, text, isHighlighted: highlight, ...(effectivePlanned ? { plannedDate: effectivePlanned } : {}) },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw Error(data.error || 'Error al conectar');
      setText('');
      if (!comment) {
        onChecklistAdded(data.item);
        setFeed((old) => old.filter((i) => i.id !== draft.id));
      } else {
        setFeed((old) => old.map((i) => (i.id === draft.id ? { ...i, pending: false } : i)));
      }
      window.dispatchEvent(new CustomEvent('anfeta_page_content_changed', { detail: { pageId } }));
      window.dispatchEvent(new Event('anfeta_activity_saved'));
      setStatus(comment ? '✅ Comentario agregado' : effectivePlanned ? `✅ Check agregado (${effectivePlanned})` : '✅ Check agregado');
    } catch (e) {
      setFeed((old) => old.filter((i) => i.id !== draft.id));
      setStatus('❌ ' + (e instanceof Error ? e.message : 'Error al conectar'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-slate-700 p-2 space-y-2">
      <input
        aria-label="Nuevo pendiente o comentario"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nuevo pendiente o comentario para esta actividad..."
        disabled={disabled || busy}
        className="w-full rounded bg-slate-900 p-2 text-xs text-white"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} disabled={busy} />
            <span>⚡ Resaltar</span>
          </label>
          <button
            type="button"
            disabled={disabled || busy || !text.trim()}
            onClick={() => add(false)}
            className="text-cyan-300 font-semibold hover:text-cyan-100 cursor-pointer disabled:opacity-40"
          >
            ☑ Check
          </button>
          <button
            type="button"
            disabled={disabled || busy || !text.trim()}
            onClick={() => add(true)}
            className="text-cyan-300 hover:text-cyan-100 cursor-pointer disabled:opacity-40"
          >
            💬 Comentario
          </button>
        </div>

        <div className="flex items-center gap-1 font-mono text-[10px]">
          <span className="text-slate-400">Fecha check:</span>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setPlannedDate((d) => (d === today ? '' : today))}
            className={`px-1.5 py-0.5 rounded border cursor-pointer ${
              plannedDate === today
                ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200 font-bold'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500'
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setPlannedDate((d) => (d === tomorrow ? '' : tomorrow))}
            className={`px-1.5 py-0.5 rounded border cursor-pointer ${
              plannedDate === tomorrow
                ? 'border-indigo-400 bg-indigo-950/80 text-indigo-200 font-bold'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-500'
            }`}
          >
            Mañ.
          </button>
          <label
            className={`relative px-1.5 py-0.5 rounded border cursor-pointer ${
              plannedDate && plannedDate !== today && plannedDate !== tomorrow
                ? 'border-amber-400 bg-amber-950/70 text-amber-200 font-bold'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
            }`}
            title="Elegir fecha específica para el nuevo check"
          >
            <span>{plannedDate && plannedDate !== today && plannedDate !== tomorrow ? plannedDate.slice(5) : '📅'}</span>
            <input
              type="date"
              value={plannedDate || today}
              disabled={disabled || busy}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>
          {plannedDate && (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => setPlannedDate('')}
              className="px-1 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-rose-300"
              title="Quitar fecha del nuevo check"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {feed.map((i) => (
        <p key={i.id} className={i.text.startsWith('⚡') ? 'mt-2 font-bold text-amber-300' : 'mt-2 text-slate-300'}>
          {i.comment ? '💬 ' : ''}
          {i.text}
          {i.plannedDate && <span className="ml-1.5 text-[10px] font-mono text-cyan-300">[{i.plannedDate}]</span>}
          {i.pending && <span className="ml-2 animate-pulse">⏳</span>}
        </p>
      ))}
      {status && <p role="status" className="mt-1 text-xs text-slate-300">{status}</p>}
    </div>
  );
}
