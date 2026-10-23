'use client';

import { useEffect, useRef, useState } from 'react';
import { loadAccountPreferences, saveAccountPreferences } from '@/lib/accountPreferences';
import { TopBarUtilities } from '../TopBarUtilities';

export interface CalendarLayoutCloudProps {
  value: any;
  onRestore: (value: any) => void;
  currentUser?: string;
  onTriggerAutomation?: () => void;
  onOpenAnnouncements?: () => void;
  cacheMeta?: any;
}

export function CalendarLayoutCloud({
  value,
  onRestore,
  currentUser,
  onTriggerAutomation,
  onOpenAnnouncements,
  cacheMeta,
}: CalendarLayoutCloudProps) {
  const latest = useRef(value);
  const restore = useRef(onRestore);
  latest.current = value;
  restore.current = onRestore;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const alive = useRef(true);
  const pending = useRef(false);

  useEffect(() => {
    alive.current = true;
    const before = JSON.stringify(latest.current);
    loadAccountPreferences()
      .then((state) => {
        if (!alive.current) return;
        const saved = state.values?.calendarLayouts?.primary;
        if (saved && JSON.stringify(latest.current) === before) {
          restore.current(saved);
          setMessage('Configuración recuperada de tu cuenta.');
        }
      })
      .catch((error) => {
        if (alive.current) {
          setMessage(error.message || 'No se pudo recuperar la configuración.');
        }
      });
    return () => {
      alive.current = false;
    };
  }, []);

  async function transfer(load = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const state = await loadAccountPreferences();
      if (load) {
        const saved = state.values?.calendarLayouts?.primary;
        if (!saved) throw new Error('Todavía no tienes una configuración guardada en tu cuenta.');
        if (alive.current) {
          restore.current(saved);
          setMessage('Configuración recuperada.');
        }
      } else {
        const layouts = state.values?.calendarLayouts;
        await saveAccountPreferences(
          {
            calendarLayouts: {
              ...(layouts && typeof layouts === 'object' && !Array.isArray(layouts) ? layouts : {}),
              primary: latest.current,
            },
          },
          state.revision
        );
        if (alive.current) setMessage('Configuración guardada para tus otros dispositivos.');
      }
    } catch (error) {
      if (alive.current) setMessage(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1 bg-[#0A0E17] border-b border-[#1A2332]/60 select-none flex-wrap sm:flex-nowrap min-h-[34px]">
      {/* Lado izquierdo: Botones de vista en nube y estado de copia/sincronización */}
      <div className="flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-none text-[10px] text-slate-300">
        <button
          disabled={busy}
          onClick={() => void transfer()}
          className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-cyan-200 hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          Guardar vista en mi cuenta
        </button>
        <button
          disabled={busy}
          onClick={() => void transfer(true)}
          className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          Recuperar vista
        </button>
        {message && (
          <span role="status" className="text-cyan-300/90 text-[10px]">
            {busy ? 'Sincronizando…' : message}
          </span>
        )}
        {cacheMeta && (
          <span
            role="status"
            className="hidden lg:inline-flex items-center text-[10px] text-cyan-200/70 border-l border-slate-800 pl-2"
          >
            {cacheMeta.source === 'supabase' ? 'Copia Supabase' : 'Lectura de Notion'}
            {cacheMeta.updatedAt
              ? ' • ' +
                new Date(cacheMeta.updatedAt).toLocaleTimeString('es-MX', {
                  timeZone: 'America/Mexico_City',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
            {cacheMeta.syncing ? ' • actualizando…' : ''}
            {cacheMeta.stale && !cacheMeta.syncing ? ' • actualización pendiente' : ''}
          </span>
        )}
      </div>

      {/* Lado derecho: Herramientas secundarias reubicadas desde la barra superior */}
      <TopBarUtilities
        currentUser={currentUser}
        onTriggerAutomation={onTriggerAutomation}
        onOpenAnnouncements={onOpenAnnouncements}
        className="shrink-0 ml-auto"
      />
    </div>
  );
}
