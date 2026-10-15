export interface UploadDraft {
  id: string;
  owner: string;
  plan: any;
  receipts: any[];
  started: boolean;
  phase?: 'empty_draft' | 'unconfirmed_started' | 'partial' | 'completed';
  updatedAt: number;
}

export type DraftStatus = 'none' | 'empty_draft' | 'unconfirmed_started' | 'partial' | 'completed';

export function getUploadDraftStatus(draft: UploadDraft | null): DraftStatus {
  if (!draft) return 'none';
  const receipts = Array.isArray(draft.receipts) ? draft.receipts : [];
  const files = Array.isArray(draft.plan?.files) ? draft.plan.files : [];
  const hasCloudActivity = files.some((f: any) => f?.cloudReceipt || f?.cloudCursor);
  const confirmedCount = receipts.filter(r => r && (r.kind === 'dropbox' || r.kind === 'notion' || r.pageId || r.path)).length;
  const mode = draft.plan?.mode || 'both';
  const plannedNotion = mode === 'notion' || mode === 'both';
  const plannedDropbox = mode === 'dropbox' || mode === 'both';

  if (confirmedCount > 0 || files.some((f: any) => f?.cloudReceipt)) {
    const dropboxFilesDone = files.length === 0 || files.every((f: any) => Boolean(f?.cloudReceipt));
    const dropboxDone = !plannedDropbox || (dropboxFilesDone && receipts.some(r => r.kind === 'dropbox'));
    const expectedPages=draft.plan?.targetPageId?1:draft.plan?.separatePages?Math.max(1,files.length):1;
    const confirmedPages=new Set(receipts.filter(r=>r.kind==='notion'||r.kind==='notion_attachment'||(!r.kind&&r.pageId)).map((r,index)=>r.pageId||r.pageUrl||'receipt-'+index)).size;
    const notionDone = !plannedNotion || confirmedPages>=expectedPages;
    if (dropboxDone && notionDone) return 'completed';
    return 'partial';
  }

  if (draft.started || hasCloudActivity) {
    return 'unconfirmed_started';
  }

  return 'empty_draft';
}

export function summarizeDraftProgress(draft: UploadDraft | null): {
  status: DraftStatus;
  summary: string;
  confirmedItems: string[];
  pendingItems: string[];
  totalFiles: number;
  uploadedFiles: number;
  confirmedReceipts: number;
} {
  const status = getUploadDraftStatus(draft);
  if (!draft || status === 'none') {
    return {
      status: 'none',
      summary: 'Sin borrador pendiente',
      confirmedItems: [],
      pendingItems: [],
      totalFiles: 0,
      uploadedFiles: 0,
      confirmedReceipts: 0
    };
  }

  const receipts = Array.isArray(draft.receipts) ? draft.receipts : [];
  const files = Array.isArray(draft.plan?.files) ? draft.plan.files : [];
  const mode = draft.plan?.mode || 'both';
  const confirmedItems: string[] = [];
  const pendingItems: string[] = [];

  for (const r of receipts) {
    if (r.kind === 'dropbox' || r.path) {
      confirmedItems.push(`Dropbox: ${r.path || r.filename || 'Archivo guardado'}`);
    } else if (r.kind === 'notion' || r.pageId) {
      confirmedItems.push(`Notion: ${r.activity?.title || r.name || 'Página creada'}`);
    }
  }

  for (const f of files) {
    if (f?.cloudReceipt && !confirmedItems.some(c => c.includes(f.filename))) {
      confirmedItems.push(`Dropbox: ${f.filename} (fragmentos completados)`);
    } else if (!f?.cloudReceipt && (mode === 'both' || mode === 'dropbox')) {
      pendingItems.push(`Subir a Dropbox: ${f.filename || 'Archivo'}`);
    }
  }

  if ((mode === 'both' || mode === 'notion') && !receipts.some(r => r.kind === 'notion' || r.pageId)) {
    pendingItems.push('Crear / vincular página en Notion');
  }

  let summary = '';
  if (status === 'completed') summary = 'Lote completado';
  else if (status === 'partial') summary = `${confirmedItems.length} pasos confirmados, ${pendingItems.length} pendientes`;
  else if (status === 'unconfirmed_started') summary = 'Subida iniciada pero sin confirmación';
  else summary = 'Borrador sin operaciones iniciadas';

  return {
    status,
    summary,
    confirmedItems,
    pendingItems,
    totalFiles: files.length,
    uploadedFiles: files.filter((f: any) => Boolean(f?.cloudReceipt)).length,
    confirmedReceipts: receipts.length
  };
}

async function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB no está disponible en este entorno.');
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const r = indexedDB.open('anfeta-upload-recovery', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('drafts', { keyPath: 'owner' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(new Error('No se pudo abrir la recuperación de subidas.'));
    } catch (e: any) {
      reject(new Error(e?.message || 'Error al acceder a almacenamiento local.'));
    }
  });
}

export async function readUploadDraft(owner: string): Promise<UploadDraft | null> {
  if (!owner) return null;
  try {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('drafts', 'readonly');
      const r = tx.objectStore('drafts').get(owner);
      tx.oncomplete = () => {
        database.close();
        resolve(r.result || null);
      };
      tx.onerror = () => {
        database.close();
        reject(new Error('No se pudo recuperar el lote.'));
      };
    });
  } catch (error) {
    console.warn('Error leyendo borrador de subida:', error);
    return null;
  }
}

export async function saveUploadDraft(draft: UploadDraft): Promise<void> {
  if (!draft?.owner) return;
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction('drafts', 'readwrite');
    tx.objectStore('drafts').put(draft);
    tx.oncomplete = () => {
      database.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      database.close();
      reject(new Error('No se pudo conservar el lote. Libera almacenamiento antes de subir.'));
    };
  });
}

export async function clearUploadDraft(owner: string): Promise<void> {
  if (!owner) return;
  try {
    const database = await db();
    return new Promise<void>((resolve, reject) => {
      const tx = database.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').delete(owner);
      tx.oncomplete = () => {
        database.close();
        resolve();
      };
      tx.onerror = () => {
        database.close();
        reject(new Error('No se pudo limpiar el lote confirmado.'));
      };
    });
  } catch (error) {
    console.warn('Error limpiando borrador de subida:', error);
  }
}
