"use client";
import React, { useRef, useState, useEffect } from 'react';
import { ACTIVITY_TAGS } from '@/services/activityTags';
import { Database } from 'lucide-react';
import { openNotionPage } from '@/services/windowsIntegration';
import { readApiJson } from '@/lib/readApiJson';

export function personWorkQuery(person: string, priorities = ['00', '11', '22', '33'], includeReview = true) {
  const entry = ACTIVITY_TAGS[person as keyof typeof ACTIVITY_TAGS];
  if (!entry) return person;
  const tags = [
    ...priorities.filter(p => ['00', '11', '22', '33'].includes(p)).map(p => entry.active + p),
    ...(includeReview ? [entry.active + '000'] : [])
  ].join(' OR ');
  return tags ? `${person}  ${tags}` : person;
}

const DEFAULT_NOTION_BASES = [
  { id: 'Revisiones', name: 'Revisiones', url: 'https://www.notion.so/2eeabd7d91b781348ed5c537ec14962e' },
  { id: 'Clientes', name: 'Clientes', url: 'https://www.notion.so/2f0abd7d91b781a0993ed4d3129ea46f' },
  { id: 'Dominios', name: 'Dominios', url: 'https://www.notion.so/2f0abd7d91b781948d43d2627adf2212' },
  { id: 'Cobrar y pagar', name: 'Cobros/Pagos', url: 'https://www.notion.so/2eeabd7d91b781a5a2eec9a20d3d656a' },
  { id: 'Programas y proyectos', name: 'Proyectos', url: 'https://www.notion.so/3cdabd7d91b7835caf8781ca85181639' },
  { id: 'Correos Contraseñas', name: 'Correos', url: 'https://www.notion.so/2f1abd7d91b781f5bd6ef2b1ecad4838' },
];

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

  const [bases, setBases] = useState(DEFAULT_NOTION_BASES);

  useEffect(() => {
    let active = true;
    fetch('/api/data?type=notion-base-links', { signal: AbortSignal.timeout(15000) })
      .then(r => r.json())
      .then(data => {
        if (!active || !Array.isArray(data?.items) || data.items.length === 0) return;
        setBases(prev => prev.map(base => {
          const found = data.items.find((it: any) =>
            it.name?.toLowerCase().includes(base.name.toLowerCase()) || it.id === base.id
          );
          return found ? { ...base, url: found.url } : base;
        }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

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

      {/* Accesos rápidos a Bases de Notion en formato de CHIPS (no en desplegable) */}
      <div className="flex flex-wrap items-center gap-1 pl-1 ml-0.5 border-l border-slate-800" title="Bases originales de Notion">
        <span className="text-[10px] text-slate-500 font-medium hidden xl:inline">Bases:</span>
        {bases.map(base => (
          <button
            key={base.id}
            type="button"
            onClick={() => openNotionPage(base.url)}
            title={`Abrir base original «${base.name}» en Notion`}
            className="flex items-center gap-1 rounded border border-cyan-900/80 bg-cyan-950/40 hover:bg-cyan-900/60 hover:border-cyan-400 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200 transition-colors cursor-pointer shadow-sm"
          >
            <Database className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
            <span>{base.name}</span>
            <span className="rounded bg-cyan-900/90 px-1 py-0.2 text-[8px] font-bold text-cyan-300 border border-cyan-700/60">
              BD
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
