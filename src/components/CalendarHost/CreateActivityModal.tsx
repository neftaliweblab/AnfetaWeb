'use client';
import React, { useState } from 'react';
import { NotionCalendarActivity } from '@/types/anfeta';
import { normalizePerson } from '@/services/identityNormalizer';
import { isDirection, isReviewer } from '@/services/activityPermissions';

const people = ['John','Neftali','Karla','Brian','Isaias','Andrade','Genaro','Sotelo','Acalli','Emmanuel'];
interface CreateActivityModalProps {
  currentUser: string;
  date: string;
  initialPerson?: string;
  initialStart?: string;
  initialEnd?: string;
  onClose: () => void;
  onCreated: (activity: NotionCalendarActivity) => void;
}

export function CreateActivityModal({
  currentUser,
  date,
  initialPerson,
  initialStart = '08:00',
  initialEnd = '09:00',
  onClose,
  onCreated,
}: CreateActivityModalProps) {
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [person, setPerson] = useState(() => {
    if (initialPerson) return normalizePerson(initialPerson);
    return normalizePerson(currentUser);
  });
  const [day, setDay] = useState(date);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
    <form className="w-full max-w-lg space-y-4 rounded-2xl border border-cyan-400/40 bg-slate-950 p-5 text-slate-200" onSubmit={async e => {
      e.preventDefault(); if (saving) return; setSaving(true); setError('');
      try {
        const response = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create-activity', payload: { title, domain, person, currentUser, start: `${day}T${start}:00-06:00`, end: `${day}T${end}:00-06:00` } }) });
        const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo crear la actividad'); onCreated(data.activity);
      } catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión'); } finally { setSaving(false); }
    }}>
      <h2 className="font-semibold">+ Nueva Actividad</h2>
      <label className="block text-sm">Título<input required autoFocus maxLength={1800} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded bg-slate-800 p-2" /></label>
      <label className="block text-sm">Dominio<input required value={domain} onChange={e => setDomain(e.target.value)} placeholder="dominio.com" className="mt-1 w-full rounded bg-slate-800 p-2" /></label>
      <label className="block text-sm">Responsable<select disabled={!isDirection(currentUser) && !isReviewer(currentUser)} value={person} onChange={e => setPerson(e.target.value)} className="ml-2 rounded bg-slate-800 p-2">{people.map(p => <option key={p}>{p}</option>)}</select></label>
      <div className="flex gap-3"><input aria-label="Fecha" required type="date" value={day} onChange={e => setDay(e.target.value)} className="min-w-0 rounded bg-slate-800 p-2" />
        <input aria-label="Inicio" required type="time" min="08:00" max="21:45" step={900} value={start} onChange={e => setStart(e.target.value)} className="min-w-0 rounded bg-slate-800 p-2" />
        <input aria-label="Fin" required type="time" min="08:15" max="22:00" step={900} value={end} onChange={e => setEnd(e.target.value)} className="min-w-0 rounded bg-slate-800 p-2" /></div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded border border-slate-600 px-3 py-2">Cancelar</button><button disabled={saving} className="rounded bg-cyan-600 px-4 py-2">{saving ? 'Guardando…' : 'Crear en Notion'}</button></div>
    </form>
  </div>;
}
