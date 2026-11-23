import { notionPageUrl } from './notionPageUrl';

export const MAX_BULK_OPEN_TABS = 15;

export interface QuickOpenSelectionSummary {
  totalSelected: number;
  notionUrls: string[];
  launchUrls: string[];
  otherItems: any[];
  headline: string;
  buttonLabel: string;
  cappedWarning: string;
}

export function isDropboxResultItem(item: any): boolean {
  if (!item) return false;
  return (
    item.source === 'Dropbox' ||
    item.sourceName === 'Dropbox' ||
    item.externalSourceName === 'Dropbox' ||
    item.type === 'FILE' ||
    item.type === 'FOLDER' ||
    Boolean(item.target && (item.target.startsWith('/') || item.target.includes(':\\')))
  );
}

/** Construye el aviso y la lista de enlaces rápidos al seleccionar uno o varios resultados. */
export function buildQuickOpenSelectionSummary(
  selectedItems: any[],
  maxTabs = MAX_BULK_OPEN_TABS
): QuickOpenSelectionSummary {
  const list = Array.isArray(selectedItems) ? selectedItems.filter(Boolean) : [];
  const totalSelected = list.length;
  const notionUrlSet = new Set<string>();
  const otherItems: any[] = [];

  for (const item of list) {
    const isDropbox = isDropboxResultItem(item) && item.source !== 'Notion';
    if (!isDropbox) {
      const url = notionPageUrl(item);
      if (url) {
        notionUrlSet.add(url);
        continue;
      }
    }
    otherItems.push(item);
  }

  const notionUrls = Array.from(notionUrlSet);
  const launchUrls = notionUrls.slice(0, maxTabs);
  const capped = Math.max(0, notionUrls.length - launchUrls.length);

  let headline = '';
  let buttonLabel = '';

  if (totalSelected === 1) {
    const single = list[0];
    const rawName = String(single?.name || single?.title || 'Resultado').replace(/^\[[^\]]+\]\s*/, '').trim();
    const shortName = rawName.length > 42 ? `${rawName.slice(0, 39)}…` : rawName;
    if (notionUrls.length > 0) {
      headline = `«${shortName}» seleccionado · ¿Quieres verlo en Notion?`;
      buttonLabel = 'Abrir en Notion ↗';
    } else {
      headline = `«${shortName}» seleccionado · ¿Abrir ahora?`;
      buttonLabel = 'Abrir ↗';
    }
  } else if (totalSelected > 1) {
    if (notionUrls.length > 0) {
      headline = `${totalSelected} resultados seleccionados · ¿Quieres verlos en Notion?`;
      buttonLabel = capped > 0
        ? `Abrir primeros ${launchUrls.length} de ${notionUrls.length} en Notion ↗`
        : `Abrir ${notionUrls.length} en Notion ↗`;
    } else {
      headline = `${totalSelected} elementos seleccionados · ¿Abrir ahora?`;
      buttonLabel = `Abrir ${Math.min(totalSelected, maxTabs)} seleccionados ↗`;
    }
  }

  const cappedWarning = capped > 0
    ? `Se abrirán ${launchUrls.length} pestañas por vez (de ${notionUrls.length}) para evitar bloqueos.`
    : '';

  return {
    totalSelected,
    notionUrls,
    launchUrls,
    otherItems,
    headline,
    buttonLabel,
    cappedWarning,
  };
}
