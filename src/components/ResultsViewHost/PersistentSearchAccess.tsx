"use client";
import React, { useState, useEffect } from 'react';
import { ACTIVITY_TAGS } from '@/services/activityTags';
import { NotionQuickAccessChips } from '@/components/NotionQuickAccessChips';

export function personWorkQuery(person: string, priorities = ['00', '11', '22', '33'], includeReview = true) {
  const entry = ACTIVITY_TAGS[person as keyof typeof ACTIVITY_TAGS];
  if (!entry) return person;
  const tags = [
    ...priorities.filter(p => ['00', '11', '22', '33'].includes(p)).map(p => entry.active + p),
    ...(includeReview ? [entry.active + '000'] : [])
  ].join(' OR ');
  return tags ? `${person}  ${tags}` : person;
}

export function PersistentSearchAccess({ onSearch, currentUser = '' }: { onSearch: (query: string) => void; currentUser?: string }) {
  const defaults = { priorities: ['00', '11', '22', '33'], includeReview: true };
  const [selection, setSelection] = useState(defaults);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('anfeta_work_priorities:' + currentUser) || 'null');
      setSelection(raw && Array.isArray(raw.priorities) ? {
        priorities: raw.priorities.filter((p: string) => defaults.priorities.includes(p)),
        includeReview: raw.includeReview !== false
      } : defaults);
    } catch {
      setSelection(defaults);
    }
  }, [currentUser]);

  function saveSelection(next: typeof defaults) {
    setSelection(next);
    try {
      localStorage.setItem('anfeta_work_priorities:' + currentUser, JSON.stringify(next));
    } catch {}
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Accesos rápidos permanentes">
      <span className="text-[10px] text-slate-400">Trabajo:</span>
      <details className="relative text-[10px]">
        <summary className="cursor-pointer rounded border border-slate-700 px-1.5 py-1 text-cyan-300">Prioridades ▾</summary>
        <fieldset className="absolute top-full z-40 mt-1 w-52 space-y-2 rounded-lg border border-slate-700 bg-slate-950 p-3 shadow-xl">
          <legend className="sr-only">Incluir en la siguiente búsqueda</legend>
          <p className="text-slate-400">Se aplican al próximo acceso por persona.</p>
          {[
            ['00', 'Urgentes'],
            ['11', 'Primarias'],
            ['22', 'Secundarias'],
            ['33', 'Usar / practicar']
          ].map(([code, label]) => (
            <label key={code} className="flex items-center gap-2 text-slate-200">
              <input
                type="checkbox"
                checked={selection.priorities.includes(code)}
                onChange={e => saveSelection({
                  ...selection,
                  priorities: e.target.checked
                    ? [...selection.priorities, code].sort()
                    : selection.priorities.filter(p => p !== code)
                })}
              />
              {code} · {label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-slate-200">
            <input
              type="checkbox"
              checked={selection.includeReview}
              onChange={e => saveSelection({ ...selection, includeReview: e.target.checked })}
            />
            Revisiones recibidas · 000
          </label>
        </fieldset>
      </details>

      {/* Botones de colaboradores */}
      {Object.keys(ACTIVITY_TAGS).map(person => (
        <button
          key={person}
          type="button"
          title={`${person} · abrir o recuperar su búsqueda de trabajo`}
          aria-label={`Abrir trabajo de ${person} en una pestaña`}
          disabled={!selection.priorities.length && !selection.includeReview}
          onClick={() => onSearch(personWorkQuery(person, selection.priorities, selection.includeReview))}
          className="rounded-md border border-cyan-900 bg-cyan-950/40 px-1.5 py-1 text-[10px] text-cyan-200 hover:border-cyan-400"
        >
          {person}
        </button>
      ))}

      {/* Accesos rápidos a Bases y Vistas de Notion en formato de CHIPS */}
      <NotionQuickAccessChips />
    </div>
  );
}
