const DB_NAME = "anfeta_cache_db_v1";
const STORE_NAME = "search_index_store";
const CACHE_KEY = "latest_index_activity_tags_v2";

export interface CachedSearchIndex {
  items: any[];
  indexVersion: string;
  total?: number;
  savedAt: number;
  cacheMeta?: any;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB not available"));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

export async function loadCachedIndex(owner?:string): Promise<CachedSearchIndex | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  if(!owner)return null;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY+':'+owner);
      req.onsuccess = () => {
        db.close();
        const val = req.result;
        if (val && Array.isArray(val.items) &&  typeof val.indexVersion === "string") {
          resolve(val as CachedSearchIndex);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {db.close();resolve(null);};
    });
  } catch {
    return null;
  }
}

export async function saveCachedIndex(data: {
  items: any[];
  indexVersion: string;
  total?: number;
  cacheMeta?: any;
},owner?:string): Promise<boolean> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return false;
  if (!owner || !Array.isArray(data.items) || !data.indexVersion) return false;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const record: CachedSearchIndex = {
        items: data.items,
        indexVersion: data.indexVersion,
        total: data.total || data.items.length,
        savedAt: Date.now(),
        cacheMeta: data.cacheMeta,
      };
      const req = store.put(record, CACHE_KEY+':'+owner);
      tx.oncomplete = () => {db.close();resolve(true);};
      tx.onabort = () => {db.close();resolve(false);};
      req.onerror = () => {db.close();resolve(false);};
    });
  } catch {
    return false;
  }
}
