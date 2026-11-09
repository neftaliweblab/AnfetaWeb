import {normalizePerson} from './identityNormalizer';
import {supabaseAdmin, supabaseConfigured} from './supabaseServer';
import type {FtfPresenceDay} from './ftfDashboard';

type PresenceProfile = {person_tag: string};
type PresenceRow = {
  day: string;
  first_seen: string;
  last_seen: string;
  profiles: PresenceProfile | PresenceProfile[] | null;
};

export async function readFtfPresenceHistory(start: string, endExclusive: string): Promise<FtfPresenceDay[]> {
  if (!supabaseConfigured()) return [];
  const {data, error} = await supabaseAdmin()
    .from('ftf_daily_presence')
    .select('day,first_seen,last_seen,profiles!inner(person_tag,active)')
    .eq('profiles.active', true)
    .gte('day', start)
    .lt('day', endExclusive);
  if (error) throw new Error('No se pudo consultar el historial de conexiones.');
  return ((data ?? []) as PresenceRow[]).flatMap(row => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return profile ? [{
      day: row.day,
      person: normalizePerson(profile.person_tag),
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    }] : [];
  });
}
