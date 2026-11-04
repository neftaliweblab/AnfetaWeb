import {calendarDisplayTitle} from '../services/calendarPresentation';
import {normalizePerson} from '../services/identityNormalizer';

/** Notices describe people and actions; only activity titles use the calendar cleaner. */
export function reviewNoticePresentation(item: any) {
  const raw=String(item.activityTitle || item.title || '');
  if(item.kind==='ftf'){
    const idPerson=String(item.id || '').match(/^ftf:\d{4}-\d{2}-\d{2}:(.+)$/)?.[1];
    const titlePerson=raw.match(/^(.+?)\s+completó su revisión FTF/i)?.[1];
    const person=normalizePerson(item.person || idPerson || titlePerson || '');
    const name=person==='Sin asignar'?'Usuario no identificado':person;
    const date=/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')?item.date.split('-').reverse().join('/'):'';
    const confirmed=item.timeKind==='confirmed'&&!!item.completedAt;
    return {
      title:name+' completó su revisión FTF'+(date?' del '+date:'.'),
      people:name,
      detail:confirmed?'Hora de finalización confirmada':'Hora de detección del sistema; no confirma la hora exacta de finalización',
      timestamp:confirmed?item.completedAt:(item.observedAt || item.updated),
    };
  }
  const author=item.authorName?normalizePerson(item.authorName):'';
  const recipient=item.recipientName?normalizePerson(item.recipientName):'';
  return {
    title:calendarDisplayTitle(raw),
    people:[author?'De: '+author:'',recipient?'Para: '+recipient:''].filter(Boolean).join(' · '),
    detail:'',timestamp:item.updated,
  };
}
