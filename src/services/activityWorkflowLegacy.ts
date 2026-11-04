export function workflowStateLegacy(status: string, title = ''): 'pending' | 'review' | 'completed' | 'suspended' | 'unknown' {
  const value = (status || '').trim().toUpperCase();
  if (/^NO\s+(?:TERMINAD[OA]|COMPLETAD[OA]|FINALIZAD[OA])\b/.test(value)) return 'pending';
  if(/^(?:(?:P?R?TUZ|UZ|Z)\s*[-:]\s*)?(?:TERMINAD[OA]|COMPLETAD[OA]|FINALIZAD[OA])(?:\s|$)/i.test(value)||/^(?:TUZ\s*[-:]\s*)?TERMINADO\s+REV\b/i.test(value)||['COMPLETED','FINISHED'].includes(value))return 'completed';
  if (/^SUSPE(?:\s|$)/.test(value) || /^(?:SAPRTUZ|SPRTUZ)\b/i.test(value)) return 'suspended';
  if (/^REVISAR REVISIONES\b|\bRREVI\b|^RTUZ\b/i.test(value)) return 'review';
  if (/^TERMINADO REV\b|^Z\s*-\s*COBRADO/i.test(value)) return 'completed';
  if (/^PRTUZ POR HACER$|^ARRANCAR ASIGNAR$|^APRTUZ\b/i.test(value)) return 'pending';
  if (['TERMINADO', 'TERMINADA', 'COMPLETADO', 'COMPLETADA', 'FINALIZADO', 'DONE', 'HECHO', 'ZREVISION', 'Z'].includes(value)) return 'completed';
  if (['EN REVISIÓN', 'EN REVISION', 'REVISION', 'IN REVIEW', 'RTUZREVISION', 'R'].includes(value)) return 'review';
  if (['PENDIENTE', 'POR HACER', 'NOT STARTED', 'SIN INICIAR', 'NO INICIADO', 'PRTUZREVISION', 'P'].includes(value)) return 'pending';
  if (['SPRTUZREVISION', 'SUSPENDIDO', 'SUSPENDIDA', 'SUSPENDIDOS', 'SUSPENDIDAS', 'SUSPENDED'].includes(value)) return 'suspended';
  if (/TERMINAD[OA]|COMPLETAD[OA]|FINALIZAD[OA]/i.test(value)) return 'completed';
  const token = title.match(/\b(sprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION)\b/i)?.[1];
  return token ? workflowStateLegacy(token) : 'unknown';
}
