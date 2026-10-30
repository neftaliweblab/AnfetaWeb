import { workflowState } from './activityWorkflow';
import { scanActivityTags } from './activityTags';
import { progressiveStage } from './progressiveWorkflow';

export interface ActivityConflict {
  hasConflict: boolean;
  type: 'completed_with_review_tag' | 'multiple_reviewers' | 'contradictory_stages';
  label: string;
  description: string;
}

export function detectActivityConflict(item: {
  name?: string;
  title?: string;
  updateStatus?: string;
  statusLabel?: string;
  status?: string;
  assignedPerson?: string;
  person?: string;
}): ActivityConflict | null {
  const title = String(item.name || item.title || '').trim();
  const status = String(item.updateStatus || item.statusLabel || item.status || '').trim();
  if (!title) return null;

  const state = workflowState(status, title);
  const tags = scanActivityTags(title);

  // 1. Conflicto: Actividad terminada que conserva tag de revisión pendiente (ej. ge000, jo000)
  const pendingReviewTags = tags.filter((t) => t.role === 'review' && t.suffix === '000');
  const isCompleted =
    state === 'completed' ||
    /^(?:z|terminad)/i.test(status) ||
    /(?<![a-z])z(?:revision|[scp]r?)\b/i.test(title);

  if (isCompleted && pendingReviewTags.length > 0) {
    const tokens = pendingReviewTags.map((t) => t.token).join(', ');
    return {
      hasConflict: true,
      type: 'completed_with_review_tag',
      label: 'Tag 000 en terminada',
      description: `Conflicto: la actividad está terminada (${status || 'Terminada'}) pero aún conserva el tag de revisión pendiente (${tokens}). Debe removerse o cambiar a referencia.`
    };
  }

  // 2. Conflicto: Doble revisor asignado simultáneamente con tag 000
  const reviewerPersons = [...new Set(pendingReviewTags.map((t) => t.person))];
  if (reviewerPersons.length > 1) {
    const tokens = pendingReviewTags.map((t) => t.token).join(', ');
    return {
      hasConflict: true,
      type: 'multiple_reviewers',
      label: 'Doble revisor asignado',
      description: `Conflicto: tiene múltiples tags de revisión activa para distintas personas (${tokens}). Solo debe tener un revisor asignado.`
    };
  }

  // 3. Conflicto: Prefijos y estados contradictorios (ej. prtuz/rtuz con TERMINADA/zREVISION, o zR con POR HACER)
  const stage = progressiveStage(title);
  const stageCode = stage?.code?.toLowerCase() || '';
  const statusLow = status.toLowerCase();

  // Caso: Título indica Por hacer (prtuzR/aprtuzR) pero el estado es Terminada o zREVISION
  if (
    (stageCode === 'prtuzr' || stageCode === 'aprtuzr') &&
    (state === 'completed' || /terminad|zrevision/i.test(statusLow))
  ) {
    return {
      hasConflict: true,
      type: 'contradictory_stages',
      label: 'Prefijo y estado opuestos',
      description: `Conflicto: el título tiene prefijo pendiente (${stage?.token}) pero el estado en Notion es ${status}.`
    };
  }

  // Caso: Título indica Terminada (zR, tuzR, uzR, ZS, ZC, ZP) pero el estado es Por hacer o Por revisar
  if (
    (stageCode === 'zr' || stageCode === 'tuzr' || stageCode === 'uzr' || /^z[scp]$/i.test(stageCode)) &&
    (state === 'pending' || state === 'review' || /por hacer|en revisi/i.test(statusLow))
  ) {
    return {
      hasConflict: true,
      type: 'contradictory_stages',
      label: 'Prefijo y estado opuestos',
      description: `Conflicto: el título tiene prefijo de terminada (${stage?.token}) pero el estado en Notion es ${status}.`
    };
  }

  // Caso: Múltiples prefijos incompatibles en el mismo título
  const revisionMatches = title.match(/(?<![a-z])(?:prtuz|rtuz|z)revision\b/gi) || [];
  if (revisionMatches.length > 1) {
    const uniqueMatches = [...new Set(revisionMatches.map((m) => m.toLowerCase()))];
    if (uniqueMatches.length > 1) {
      return {
        hasConflict: true,
        type: 'contradictory_stages',
        label: 'Doble prefijo de revisión',
        description: `Conflicto: el título contiene prefijos contradictorios (${uniqueMatches.join(', ')}).`
      };
    }
  }

  return null;
}

export function hasActivityConflict(item: any): boolean {
  return detectActivityConflict(item) !== null;
}
