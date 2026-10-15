import { NextResponse } from 'next/server';
import { normalizePerson } from '@/services/identityNormalizer';
import {
  getActiveAnnouncement,
  saveAnnouncement,
  markAnnouncementAsSeen,
  clearActiveAnnouncement,
  getTeamMembersList,
  AnnouncementItem
} from '@/services/announcementService';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const currentUser = url.searchParams.get('currentUser') || '';
    const isNeftali = normalizePerson(currentUser) === 'Neftali';

    const active = await getActiveAnnouncement();
    const allPeople = getTeamMembersList();

    // If Neftali is viewing, always return announcement (even if inactive) to see stats
    const announcement = isNeftali ? active : (active?.active ? active : null);

    return NextResponse.json(
      {
        success: true,
        announcement,
        allPeople
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al consultar novedades.'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'publish') {
      const actor = normalizePerson(body.actor || body.currentUser);
      if (actor !== 'Neftali') {
        return NextResponse.json(
          { error: 'Solo Neftali tiene autorización para publicar novedades.' },
          { status: 403 }
        );
      }

      const title = String(body.title || '').trim();
      if (!title) {
        return NextResponse.json(
          { error: 'El título de la actualización es obligatorio.' },
          { status: 400 }
        );
      }

      const version = String(body.version || 'v' + new Date().toISOString().slice(0, 10)).trim();
      const date = String(body.date || new Date().toLocaleDateString('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })).trim();
      const image = String(body.image || '').trim();
      const rawChanges: unknown = body.changes;
      const changes: string[] = Array.isArray(rawChanges)
        ? rawChanges.map(c => String(c).trim()).filter(Boolean)
        : String(rawChanges || '')
            .split('\n')
            .map(c => c.trim())
            .filter(Boolean);

      const item: AnnouncementItem = {
        id: 'update-' + Date.now().toString(36),
        title,
        version,
        date,
        image,
        changes,
        author: 'Neftali',
        createdAt: new Date().toISOString(),
        seenBy: {},
        active: true
      };

      await saveAnnouncement(item);
      return NextResponse.json({ success: true, announcement: item });
    }

    if (action === 'mark-seen') {
      const id = String(body.id || '');
      const person = normalizePerson(body.person || body.currentUser);
      if (!id || person === 'Sin asignar') {
        return NextResponse.json({ error: 'Faltan parámetros para confirmar lectura.' }, { status: 400 });
      }

      await markAnnouncementAsSeen(id, person);
      return NextResponse.json({ success: true, person });
    }

    if (action === 'clear') {
      const actor = normalizePerson(body.actor || body.currentUser);
      if (actor !== 'Neftali') {
        return NextResponse.json(
          { error: 'Solo Neftali puede desactivar novedades.' },
          { status: 403 }
        );
      }

      await clearActiveAnnouncement();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar la novedad.' },
      { status: 500 }
    );
  }
}
