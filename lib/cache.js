// Local cache in IndexedDB. Only for speed: Google Drive is the real copy.
let cdb = null;

export function openCache() {
  return new Promise((res) => {
    try {
      const r = indexedDB.open("meme-vault-cache", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("blobs"); r.result.createObjectStore("kv"); };
      r.onsuccess = () => { cdb = r.result; res(); };
      r.onerror = () => res();
    } catch { res(); }
  });
}

function op(name, mode, fn) {
  return new Promise((res, rej) => {
    if (!cdb) return res(undefined);
    try {
      const r = fn(cdb.transaction(name, mode).objectStore(name));
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}

export const cacheGet = (id) => op("blobs", "readonly", (s) => s.get(id)).catch(() => undefined);
export const cachePut = (id, b) => op("blobs", "readwrite", (s) => s.put(b, id)).catch(() => {});
export const cacheDel = (id) => op("blobs", "readwrite", (s) => s.delete(id)).catch(() => {});
export const kvGet = (k) => op("kv", "readonly", (s) => s.get(k)).catch(() => undefined);
export const kvPut = (k, v) => op("kv", "readwrite", (s) => s.put(v, k)).catch(() => {});
export const clearStore = (n) => op(n, "readwrite", (s) => s.clear()).catch(() => {});
