"use client";
import { useEffect, useRef } from 'react';
import {
  rememberDeletedPages,
  pageIdentity,
  deletedPages,
  restoreConfirmedPages,
  setUnverifiedPage,
  clearUnverifiedPage,
  PAGE_SYNC_CHANNEL
} from '@/lib/deletedPages';

/**
 * Bounded validation of visible records and delta event synchronization.
 * Never performs a complete index query per tick.
 * Synchronizes confirmed deletions and updates across sessions and tabs in ~5 seconds.
 */
export function useNotionPageWatch(
  owner: string,
  rows: any[],
  enabled: boolean,
  onStates: (states: any[]) => void
) {
  const latest = useRef({ rows, onStates });
  latest.current = { rows, onStates };
  const lastSyncRef = useRef<string | null>(null);
  const unverifiedBackoffRef = useRef<Map<string, { failures: number; cooldownUntil: number }>>(new Map());

  useEffect(() => {
    if (!enabled || !owner) return;
    let active = true;
    let busy = false;
    let cursor = 0;
    let restoreCursor = 0;
    let nextProbeAt=0;
    const controller = new AbortController();

    const getNotionToken = (): string => {
      try {
        return JSON.parse(localStorage.getItem('anfeta_settings') || '{}').notionToken || '';
      } catch {
        return '';
      }
    };

    // 1. Cross-tab real-time listener via BroadcastChannel
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel(PAGE_SYNC_CHANNEL);
        broadcastChannel.onmessage = (event) => {
          if (!active || !event.data) return;
          const { type, owner: msgOwner, ids, states } = event.data;
          if (msgOwner !== owner) return;
          if (type === 'deleted' && Array.isArray(ids)) {
            rememberDeletedPages(owner, ids);
          } else if (type === 'restored' && Array.isArray(ids)) {
            restoreConfirmedPages(owner, ids);
          }
          if (Array.isArray(states) && states.length) {
            latest.current.onStates(states);
          }
        };
      }
    } catch {}

    const check = async () => {
      if (!active || busy || document.hidden) return;
      busy = true;

      try {
        const token = getNotionToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(token ? { 'x-notion-token': token } : {})
        };

        // Phase A: Server Delta Sync (fetches events persisted in Supabase / server cache since last sync)
        try {
          const syncResponse = await fetch('/api/data', {
            method: 'POST',
            headers,
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]),
            body: JSON.stringify({
              action: 'sync-page-events',
              payload: { since: lastSyncRef.current, limit: 100 }
            })
          });

          if (syncResponse.ok && active) {
            const syncData = await syncResponse.json();
            if (syncData.timestamp) {
              lastSyncRef.current = syncData.timestamp;
            }

            if (Array.isArray(syncData.events) && syncData.events.length > 0) {
              const deletedIds: string[] = [];
              const restoredIds: string[] = [];
              const stateUpdates: any[] = [];

              for (const ev of syncData.events) {
                const pid = pageIdentity(ev.pageId);
                if (ev.state === 'deleted') {
                  deletedIds.push(pid);
                  stateUpdates.push({ id: pid, deleted: true });
                } else if (ev.state === 'active') {
                  restoredIds.push(pid);
                  clearUnverifiedPage(pid);
                  stateUpdates.push({
                    id: pid,
                    deleted: false,
                    name: ev.properties?.name,
                    assignedPerson: ev.properties?.assignedPerson,
                    updateStatus: ev.properties?.updateStatus,
                    serverModified: ev.serverModified,
                    scheduledDate: ev.properties?.scheduledDate,scheduledEnd:ev.properties?.scheduledEnd,ftfVerified:ev.properties?.ftfVerified,ftfAvailable:ev.properties?.ftfAvailable
                  });
                } else if (ev.state === 'unverified') {
                  setUnverifiedPage(pid, ev.unverifiedReason);
                  stateUpdates.push({ id: pid, unverified: true, reason: ev.unverifiedReason });
                }
              }

              if (deletedIds.length) rememberDeletedPages(owner, deletedIds);
              if (restoredIds.length) restoreConfirmedPages(owner, restoredIds);
              if (stateUpdates.length) latest.current.onStates(stateUpdates);
            }
          }
        } catch {
          // Delta sync network failure is non-fatal; proceed to bounded check
        }

        if(Date.now()<nextProbeAt)return;
        nextProbeAt=Date.now()+60000;
        // Phase B: Bounded Direct Polling (max 4 IDs per tick, rotating with unverified backoff)
        const now = Date.now();
        const candidateIds = [...new Set(
          latest.current.rows
            .filter(row => row.source === 'Notion' || !!row.pageId)
            .map(pageIdentity)
        )].filter(id => {
          if (!/^[a-f0-9]{32}$/.test(id)) return false;
          const backoff = unverifiedBackoffRef.current.get(id);
          if (backoff && backoff.cooldownUntil > now) return false; // skip cooling down IDs
          return true;
        });

        const removed = [...deletedPages(owner)];
        if (!candidateIds.length && !removed.length) return;

        const maxRegular = removed.length ? 3 : 4;
        const selected: string[] = [];

        if (candidateIds.length) {
          const count = Math.min(maxRegular, candidateIds.length);
          for (let i = 0; i < count; i++) {
            selected.push(candidateIds[(cursor + i) % candidateIds.length]);
          }
          cursor = (cursor + count) % candidateIds.length;
        }

        if (removed.length) {
          selected.push(removed[restoreCursor++ % removed.length]);
        }

        if (!selected.length) return;

        const response = await fetch('/api/data', {
          method: 'POST',
          headers,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
          body: JSON.stringify({ action: 'notion-page-states', payload: { ids: selected } })
        });

        const data = await response.json();
        if (active && response.ok && Array.isArray(data.states)) {
          const deleted = data.states.filter((s: any) => s.deleted).map((s: any) => s.id);
          const activePages = data.states.filter((s: any) => s.deleted === false && !s.unverified);
          const unverifiedPagesList = data.states.filter((s: any) => s.unverified);

          if (deleted.length) {
            rememberDeletedPages(owner, deleted);
            for (const id of deleted) unverifiedBackoffRef.current.delete(id);
          }

          if (activePages.length) {
            restoreConfirmedPages(owner, activePages.map((s: any) => s.id));
            for (const s of activePages) {
              clearUnverifiedPage(s.id);
              unverifiedBackoffRef.current.delete(s.id);
            }
          }

          for (const s of unverifiedPagesList) {
            setUnverifiedPage(s.id, s.reason);
            const current = unverifiedBackoffRef.current.get(s.id) || { failures: 0, cooldownUntil: 0 };
            const nextFailures = current.failures + 1;
            // After 3 consecutive unverified responses, cool down for 30 seconds
            const cooldown = nextFailures >= 3 ? Date.now() + 30000 : 0;
            unverifiedBackoffRef.current.set(s.id, { failures: nextFailures, cooldownUntil: cooldown });
          }

          latest.current.onStates(data.states);
        }
      } catch {
        /* A timeout, network error or 404 never proves deletion. */
      } finally {
        busy = false;
      }
    };

    const timer = setInterval(() => void check(), 5000);
    const onFocusOrOnline = () => {
      void check();
    };

    window.addEventListener('focus', onFocusOrOnline);
    window.addEventListener('online', onFocusOrOnline);
    void check();

    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', onFocusOrOnline);
      window.removeEventListener('online', onFocusOrOnline);
      if (broadcastChannel) {
        try {
          broadcastChannel.close();
        } catch {}
      }
    };
  }, [owner, enabled]);
}
