import phaseOneCatalog from '../../data/notion_template_phase1_catalog_v2.json';

export interface NotionBaseLinkEntry {
  id: string;
  databaseId: string;
  name: string;
  url: string;
}

export interface NotionViewEntry {
  id: string;
  pageId?: string;
  name: string;
  url?: string;
  status: 'ready' | 'pending';
  tooltip: string;
  keywords: string[];
}

export const DEFAULT_NOTION_BASES: NotionBaseLinkEntry[] = [
  { id: 'Revisiones', databaseId: '2eeabd7d91b781348ed5c537ec14962e', name: 'Revisiones', url: 'https://www.notion.so/2eeabd7d91b781348ed5c537ec14962e' },
  { id: 'Clientes', databaseId: '2f0abd7d91b781a0993ed4d3129ea46f', name: 'Clientes', url: 'https://www.notion.so/2f0abd7d91b781a0993ed4d3129ea46f' },
  { id: 'Dominios', databaseId: '2f0abd7d91b781948d43d2627adf2212', name: 'Dominios', url: 'https://www.notion.so/2f0abd7d91b781948d43d2627adf2212' },
  { id: 'Cobrar y pagar', databaseId: '2eeabd7d91b781a5a2eec9a20d3d656a', name: 'Ingresos/Egresos', url: 'https://www.notion.so/2eeabd7d91b781a5a2eec9a20d3d656a' },
  { id: 'Programas y proyectos', databaseId: '3cdabd7d91b7835caf8781ca85181639', name: 'Proyectos', url: 'https://www.notion.so/3cdabd7d91b7835caf8781ca85181639' },
  { id: 'Correos Contraseñas', databaseId: '2f1abd7d91b781f5bd6ef2b1ecad4838', name: 'Correos', url: 'https://www.notion.so/2f1abd7d91b781f5bd6ef2b1ecad4838' },
];

export const NOTION_VIEWS: NotionViewEntry[] = [
  {
    id: 'vista-egresos',
    pageId: '9d8abd7d91b782f9b47c8109ef3fb075',
    name: 'Egresos',
    url: 'https://app.notion.com/p/aaprtuzR-VSzU-Egresos-11-c-00-00-Creador-Vista-Tablero-Pagos-Egresos-Weblab-ccrea-vvist-tt-9d8abd7d91b782f9b47c8109ef3fb075?pvs=21',
    status: 'ready',
    tooltip: 'Abrir Vista Tablero de Pagos / Egresos en Notion',
    keywords: ['egresos', 'pagos', 'vvist', 'vszu', 'ttabl'],
  },
  {
    id: 'vista-ingresos',
    pageId: '385abd7d91b78255b3f781c02fe9100d',
    name: 'Ingresos',
    url: 'https://app.notion.com/p/aaprtuzR-VSzU-Igresos-11-c-00-00-Vista-Cobros-Ingresos-Weblab-ccrea-vvist-ttabl-ccobr-iing-385abd7d91b78255b3f781c02fe9100d?pvs=21',
    status: 'ready',
    tooltip: 'Abrir Vista Tablero de Cobros / Ingresos en Notion',
    keywords: ['ingresos', 'igresos', 'cobros', 'vvist', 'vszu', 'ttabl'],
  },
  {
    id: 'vista-operativo',
    name: 'Operativo',
    status: 'pending',
    tooltip: 'Vista Operativo · Pendiente de ayer (enlace de Notion por confirmar)',
    keywords: ['operativo', 'vvist', 'vszu'],
  },
];

const VIEW_PAGE_IDS = new Set(
  NOTION_VIEWS.map((view) => view.pageId).filter((id): id is string => Boolean(id))
);

const TEMPLATE_CATALOG_IDS = new Set(
  ((phaseOneCatalog as { Items?: Array<{ PageId?: string }> })?.Items || [])
    .map((item) => String(item.PageId || '').replace(/-/g, '').toLowerCase())
    .filter(Boolean)
);

function normalizedItemPageId(item: any): string {
  return String(item?.externalId || item?.pageId || item?.id || '')
    .replace(/^notion:/i, '')
    .replace(/^review-mirror-/i, '')
    .replace(/-/g, '')
    .toLowerCase();
}

function itemTitleAndSearchText(item: any): string {
  return [
    item?.name,
    item?.title,
    item?.displayName,
    item?.searchText,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Matches Notion view/dashboard pages (`vvist`, `vvsz`, `ttabl`, `VSzU`) and configured views. */
export function isNotionViewItem(item: any): boolean {
  if (!item) return false;
  const pageId = normalizedItemPageId(item);
  if (pageId && VIEW_PAGE_IDS.has(pageId)) return true;

  const text = itemTitleAndSearchText(item).toLowerCase();
  return (
    /\b(?:vvist|vvszvszu|vvsz|vszu|ttabl?)\b/i.test(text) ||
    /\bvsz\s*u\b/i.test(text)
  );
}

/** Matches Notion template pages located inside Revisiones (`#ffase00`, `aaprtuz*`, catalog IDs, hyphenated member tags). */
export function isTemplateItem(item: any): boolean {
  if (!item) return false;
  const pageId = normalizedItemPageId(item);
  if (pageId && TEMPLATE_CATALOG_IDS.has(pageId)) return true;

  const title = String(item?.name || item?.title || '');
  const full = itemTitleAndSearchText(item);
  if (
    /(?:plantillas?|00plant|#?ffase00|\baaprtuzs\b|\baaprtuzrevision\b|\bee-d\d{2}\b|\bnn-e\d{2}\b|\baa-n\d{2}\b|\baa-c\d{2}\b|\bii-s\d{2}\b|\bkk-a\d{2}\b|\bss-o\d{2}\b|\bbb-r\d{2}\b|\bgg-e\d{2}\b|\b(?:jj-o|gg-e)0{3,4}\b)/i.test(full)
  ) {
    return true;
  }
  if (!isNotionViewItem(item) && /\baaprtuz[r]?\b/i.test(full)) {
    return true;
  }

  return /\b(?:n-neft|k-karl|b-bria|g-gena|j-john|i-isai|e-edwi|s-sote|a-acal|a-andr)\b/i.test(title);
}
