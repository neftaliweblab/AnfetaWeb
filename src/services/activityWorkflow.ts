export function workflowState(status: string, title = ''): 'pending' | 'review' | 'completed' | 'suspended' | 'unknown' {
  const value = (status || '').trim().toUpperCase();
  if (/^SUSPE(?:\s|$)/.test(value)) return 'suspended';
  if (/^REVISAR REVISIONES\b|\bRREVI\b/.test(value)) return 'review';
  if (/^TERMINADO REV\b|^Z\s*-\s*COBRADO/.test(value)) return 'completed';
  if (/^PRTUZ POR HACER$|^ARRANCAR ASIGNAR$/.test(value)) return 'pending';
  if (['TERMINADO', 'TERMINADA', 'COMPLETADO', 'COMPLETADA', 'FINALIZADO', 'DONE', 'HECHO', 'ZREVISION', 'Z'].includes(value)) return 'completed';
  if (['EN REVISIÓN', 'EN REVISION', 'REVISION', 'IN REVIEW', 'RTUZREVISION', 'R'].includes(value)) return 'review';
  if (['PENDIENTE', 'POR HACER', 'NOT STARTED', 'SIN INICIAR', 'NO INICIADO', 'PRTUZREVISION', 'P'].includes(value)) return 'pending';
  if (['SPRTUZREVISION', 'SUSPENDIDO', 'SUSPENDIDA', 'SUSPENDIDOS', 'SUSPENDIDAS', 'SUSPENDED'].includes(value)) return 'suspended';
  const token = title.match(/\b(sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)\b/i)?.[1];
  return token ? workflowState(token) : 'unknown';
}
