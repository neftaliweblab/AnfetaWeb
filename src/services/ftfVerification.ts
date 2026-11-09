export const FTF_CHECKBOX = 'Check FTF Pasos Verificados Hoy';
export const FTF_EMOJI_CHECKBOX = '🔥 Check FTF Pasos Verificados Hoy';
export const FTF_AUDIT_CHECKBOX = '🔥 Audit FTF';

export function normalizeFtfPropertyName(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\s]/gi, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function ftfField(page: any): [string, any] | undefined {
  if (!page || !page.properties) return undefined;
  return Object.entries(page.properties || {}).find(([name, p]: any) => {
    if (p.type !== 'checkbox') return false;
    const norm = normalizeFtfPropertyName(name);
    return (
      norm === normalizeFtfPropertyName(FTF_CHECKBOX) ||
      norm === normalizeFtfPropertyName(FTF_EMOJI_CHECKBOX) ||
      norm === normalizeFtfPropertyName(FTF_AUDIT_CHECKBOX) ||
      norm === 'audit ftf' ||
      norm === 'check ftf' ||
      (norm.includes('ftf') && (norm.includes('pasos') || norm.includes('verificados') || norm.includes('audit') || norm.includes('check')))
    );
  }) as [string, any] | undefined;
}

export function ftfState(page: any) {
  const field = ftfField(page);
  return { ftfVerified: field?.[1]?.checkbox === true, ftfAvailable: !!field };
}
