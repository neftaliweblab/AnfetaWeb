import { normalizePerson, PERSON_METADATA } from './identityNormalizer';
import { supabaseConfigured, supabaseAdmin } from './supabaseServer';
import { getSettings } from './serverSettings';
import { readUserState, updateUserState } from './userState';

export interface AnnouncementItem {
  id: string;
  title: string;
  version: string;
  date: string;
  image?: string;
  changes: string[];
  author: string;
  createdAt: string;
  seenBy: Record<string, string>; // { "John": "2026-10-15T13:40:00.000Z", ... }
  active: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __anfetaActiveAnnouncement: AnnouncementItem | null | undefined;
}

const STORAGE_KEY = 'announcements_v1';

export async function getActiveAnnouncement(): Promise<AnnouncementItem | null> {
  if (globalThis.__anfetaActiveAnnouncement !== undefined) {
    return globalThis.__anfetaActiveAnnouncement;
  }

  // Try reading from userState under 'Neftali' preferences
  try {
    const settings = getSettings();
    const state = await readUserState(settings, 'Neftali');
    const saved = state.values?.notifications?.[STORAGE_KEY];
    if (saved && typeof saved === 'object' && saved.id) {
      globalThis.__anfetaActiveAnnouncement = saved as AnnouncementItem;
      return saved as AnnouncementItem;
    }
  } catch (error) {
    console.warn('[Announcements] No se pudo leer anuncio persistido:', error);
  }

  globalThis.__anfetaActiveAnnouncement = null;
  return null;
}

export async function saveAnnouncement(announcement: AnnouncementItem): Promise<AnnouncementItem> {
  globalThis.__anfetaActiveAnnouncement = announcement;

  try {
    const settings = getSettings();
    const state = await readUserState(settings, 'Neftali');
    const notifications = {
      ...(state.values?.notifications || {}),
      [STORAGE_KEY]: announcement
    };
    await updateUserState(settings, 'Neftali', { notifications }, state.revision);
  } catch (error) {
    console.warn('[Announcements] No se pudo persistir en storage remoto, conservado en memoria:', error);
  }

  return announcement;
}

export async function markAnnouncementAsSeen(id: string, person: string): Promise<boolean> {
  const current = await getActiveAnnouncement();
  if (!current || current.id !== id) return false;

  const canonical = normalizePerson(person);
  if (canonical === 'Sin asignar') return false;

  const nextSeenBy = {
    ...(current.seenBy || {}),
    [canonical]: new Date().toISOString()
  };

  const updated: AnnouncementItem = {
    ...current,
    seenBy: nextSeenBy
  };

  await saveAnnouncement(updated);
  return true;
}

export async function clearActiveAnnouncement(): Promise<boolean> {
  const current = await getActiveAnnouncement();
  if (!current) return true;

  const updated: AnnouncementItem = {
    ...current,
    active: false
  };

  await saveAnnouncement(updated);
  return true;
}

export function getTeamMembersList() {
  return Object.entries(PERSON_METADATA)
    .filter(([name]) => name !== 'Sin asignar' && normalizePerson(name) !== 'Neftali')
    .map(([name, meta]) => ({
      name,
      avatar: meta.avatar,
      color: meta.color,
      role: meta.role || ''
    }));
}
