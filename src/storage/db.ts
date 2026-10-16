import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * IndexedDB `cadres`: his backgrounds, and cached cut-outs keyed by the photo
 * file's SHA-256. Every access is guarded; storage trouble never breaks editing.
 */

/*
 * Images are stored as raw bytes, not Blobs: WebKit can't keep Blobs in
 * IndexedDB in some sessions, while ArrayBuffers work everywhere.
 */

export interface StoredBackground {
  id: string;
  name: string;
  createdAt: number;
  /** JPEG bytes, long edge at most 3000px (a Blob in data saved by 0.2). */
  image: ArrayBuffer | Blob;
  /** JPEG bytes, long edge 400px (a Blob in data saved by 0.2). */
  thumb: ArrayBuffer | Blob;
}

export interface StoredMask {
  hash: string;
  /** PNG cut-out with alpha. */
  png: ArrayBuffer;
  size: number;
  usedAt: number;
}

interface CadresDb extends DBSchema {
  backgrounds: { key: string; value: StoredBackground; indexes: { createdAt: number } };
  masks: { key: string; value: StoredMask; indexes: { usedAt: number } };
}

const DB_NAME = 'cadres';
const DB_VERSION = 2;

let opening: Promise<IDBPDatabase<CadresDb>> | null = null;

export function db(): Promise<IDBPDatabase<CadresDb>> {
  opening ??= openDB<CadresDb>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion, _newVersion, transaction) {
      // Migrations run in order from the stored version.
      if (oldVersion < 1) {
        database.createObjectStore('backgrounds', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
        database.createObjectStore('masks', { keyPath: 'hash' }).createIndex('usedAt', 'usedAt');
      }
      if (oldVersion === 1) {
        // Version 1 stored Blobs; cut-outs are only a cache, so start it afresh.
        void transaction.objectStore('masks').clear();
      }
    },
  });
  return opening;
}

/* Backgrounds */

export async function listBackgrounds(): Promise<StoredBackground[]> {
  try {
    const all = await (await db()).getAll('backgrounds');
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** Throws on quota errors, so the caller can tell him storage is full. */
export async function putBackground(background: StoredBackground): Promise<void> {
  await (await db()).put('backgrounds', background);
}

export async function deleteBackground(id: string): Promise<void> {
  try {
    await (await db()).delete('backgrounds', id);
  } catch {
    // Already gone.
  }
}

/* Cut-out cache: LRU, at most 20 entries or 300 MB. */

export const MASK_LIMITS = { count: 20, bytes: 300 * 1024 * 1024 };

/** Which entries to drop, least recently used first, to get back under the limits. */
export function evictionOrder(
  entries: Pick<StoredMask, 'hash' | 'size' | 'usedAt'>[],
  limits = MASK_LIMITS,
): string[] {
  const sorted = [...entries].sort((a, b) => a.usedAt - b.usedAt);
  let count = sorted.length;
  let bytes = sorted.reduce((sum, entry) => sum + entry.size, 0);
  const evict: string[] = [];
  for (const entry of sorted) {
    if (count <= limits.count && bytes <= limits.bytes) break;
    evict.push(entry.hash);
    count--;
    bytes -= entry.size;
  }
  return evict;
}

export async function getMask(hash: string): Promise<Blob | null> {
  try {
    const database = await db();
    const entry = await database.get('masks', hash);
    if (!entry?.png) return null;
    await database.put('masks', { ...entry, usedAt: Date.now() });
    return new Blob([entry.png], { type: 'image/png' });
  } catch {
    return null;
  }
}

export async function putMask(hash: string, blob: Blob): Promise<void> {
  try {
    const database = await db();
    await database.put('masks', { hash, png: await blob.arrayBuffer(), size: blob.size, usedAt: Date.now() });
    const all = await database.getAll('masks');
    const evict = evictionOrder(all.map(({ hash: h, size, usedAt }) => ({ hash: h, size, usedAt })));
    await Promise.all(evict.map((key) => database.delete('masks', key)));
  } catch {
    // A missing cache entry only means the cut-out runs again next time.
  }
}
