const DB_NAME = 'lyga_e2ee_keys';
const STORE_NAME = 'workspace_keys';
const memoryFallback = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function saveWorkspaceKey(workspaceId: string, wmk: string): Promise<void> {
  memoryFallback.set(workspaceId, wmk);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(wmk, workspaceId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // memoryFallback already holds the key for this session
  }
}

export async function getWorkspaceKey(workspaceId: string): Promise<string | null> {
  const cached = memoryFallback.get(workspaceId);
  if (cached) return cached;
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(workspaceId);
      req.onsuccess = () => {
        db.close();
        const val = typeof req.result === 'string' ? req.result : null;
        if (val) memoryFallback.set(workspaceId, val);
        resolve(val);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}
