import {NextResponse} from 'next/server';
import {assertSameOrigin,requireActor} from '@/services/serverAuth';
import {supabaseConfigured,supabaseIdentity,supabaseAdmin} from '@/services/supabaseServer';
import {normalizePerson} from '@/services/identityNormalizer';

function formatLastSeen(lastSeen: string | null, isOnline: boolean): string {
  if (isOnline) return 'En linea';
  if (!lastSeen) return 'Sin conexion';
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  if (diffMs <= 0) return 'En linea';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return 'Hace ' + mins + ' min';
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const d = new Date(lastSeen);
    const timeStr = d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Mexico_City',
    });
    return 'Hoy ' + timeStr;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) {
    const d = new Date(lastSeen);
    const timeStr = d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Mexico_City',
    });
    return 'Ayer ' + timeStr;
  }
  const d = new Date(lastSeen);
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Mexico_City',
  });
}

async function getTeamPresenceList() {
  const admin = supabaseAdmin();
  const [presence, profiles] = await Promise.all([
    admin.from('team_presence').select('user_id,last_seen'),
    admin.from('profiles').select('id,person_tag').eq('active', true)
  ]);
  if (presence.error || profiles.error) {
    throw new Error('No se pudo consultar la presencia del equipo.');
  }

  interface PresenceRow { user_id: string; last_seen: string; }
  interface ProfileRow { id: string; person_tag: string; }

  const presenceMap = new Map<string, string>();
  for (const row of ((presence.data as PresenceRow[] | null) || [])) {
    presenceMap.set(row.user_id, row.last_seen);
  }

  const list = (((profiles.data as ProfileRow[] | null) || [])).map(prof => {
    const lastSeen = presenceMap.get(prof.id) || null;
    const isOnline = Boolean(lastSeen && (Date.now() - new Date(lastSeen).getTime()) <= 150000);
    return {
      name: normalizePerson(prof.person_tag),
      tag: prof.person_tag,
      isOnline,
      lastSeen,
      lastSeenLabel: formatLastSeen(lastSeen, isOnline)
    };
  });

  list.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    if (a.lastSeen && b.lastSeen) return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    if (a.lastSeen) return -1;
    if (b.lastSeen) return 1;
    return a.name.localeCompare(b.name);
  });

  return list;
}

export async function GET(req: Request) {
  try {
    assertSameOrigin(req);
    if (!supabaseConfigured()) return NextResponse.json({configured: false, people: []});
    const people = await getTeamPresenceList();
    return NextResponse.json({configured: true, people}, {headers: {'Cache-Control': 'no-store'}});
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo obtener la presencia.';
    return NextResponse.json({error: message}, {status: 502});
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await requireActor(req);
    if (!supabaseConfigured()) return NextResponse.json({configured: false, people: []});
    const identity = await supabaseIdentity(), admin = supabaseAdmin();
    const result = await admin.from('team_presence').upsert({user_id: identity.id, last_seen: new Date().toISOString()});
    if (result.error) throw new Error('Ejecuta la cuarta migracion para activar la presencia del equipo.');
    const people = await getTeamPresenceList();
    return NextResponse.json({configured: true, people}, {headers: {'Cache-Control': 'no-store'}});
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo actualizar la presencia.';
    return NextResponse.json({error: message}, {status: /Inicia sesion/i.test(message) ? 401 : 502});
  }
}
