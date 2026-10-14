// The vault: holds the clip library and keeps it in sync with Google Drive.
// React components read it through useVault() and call the exported actions.
import { useSyncExternalStore } from "react";
import { CLIENT_ID, LIB_NAME, THUMBS_NAME } from "./config";
import { kindOf, lsGet, lsSet, fmtSize } from "./utils";
import { openCache, cacheGet, cachePut, cacheDel, kvGet, kvPut, clearStore } from "./cache";
import { videoMeta, imageMeta, audioMeta } from "./analyze";
import * as drive from "./drive";

/* ---------- state that React shows ---------- */
let state = {
  items: [],      // clip metadata
  thumbs: {},     // id -> small jpeg data URL
  conn: "signedout", // setup | signedout | connecting | connected | expired | error
  sync: "saved",     // saved | pending | saving | error
  quotaText: "",
  upload: null,      // { text, p } while uploading
  toast: null,       // { msg, key }
};
const listeners = new Set();
function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const getState = () => state;
export function useVault() {
  return useSyncExternalStore(subscribe, getState, getState);
}

/* ---------- internal sync state ---------- */
let folderId = null, libFileId = null, thumbsFileId = null, libModified = null, thumbsModified = null;
let dirtyLib = false, dirtyThumbs = false, saving = false, saveT = null, lastCheck = 0;
let uploading = false, expT = null, started = false, modalOpen = false, internalDrag = false, toastSeq = 0;
const blobUrls = new Map(), inflight = new Map(), renameTimers = {};

const byId = (id) => state.items.find((i) => i.id === id);
export const setModalOpen = (v) => { modalOpen = v; };
export const toast = (msg) => set({ toast: { msg, key: ++toastSeq } });
export const isInternalDrag = () => internalDrag;

function snapshot(withThumbs) {
  kvPut("snap", { folderId, libFileId, thumbsFileId, libModified, thumbsModified, items: state.items });
  if (withThumbs) kvPut("thumbs", state.thumbs);
}

/* ---------- start-up ---------- */
export async function init() {
  if (started) return;
  started = true;

  drive.setAuthLostHandler(() => {
    if (["connected", "connecting", "error"].includes(state.conn)) {
      set({ conn: "expired" });
      toast("Drive session ended. Click Reconnect Drive");
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastCheck > 20000) refreshFromDrive(false);
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirtyLib || dirtyThumbs || uploading) { flush(); e.preventDefault(); e.returnValue = ""; }
  });

  await openCache();
  const snap = await kvGet("snap");
  if (snap && Array.isArray(snap.items)) {
    ({ folderId, libFileId, thumbsFileId, libModified, thumbsModified } = snap);
    set({ items: snap.items, thumbs: (await kvGet("thumbs")) || {} });
  }

  if (!CLIENT_ID) { set({ conn: "setup" }); return; }
  set({ conn: lsGet("mv-was-signed", false) ? "expired" : "signedout" });

  try { await drive.initAuth(); }
  catch { toast("Google sign-in did not load, check your internet and refresh"); return; }

  if (drive.loadSavedToken()) { armExpiry(); connect(); }
}

function armExpiry() {
  clearTimeout(expT);
  const ms = drive.getTokenExp() - Date.now() - 20000;
  expT = setTimeout(() => {
    if (state.conn === "connected") { drive.clearToken(); set({ conn: "expired" }); }
  }, Math.max(0, ms));
}

export async function signInAndConnect() {
  try { await drive.signIn(); }
  catch (e) {
    toast(e.message === "gis" ? "Google sign-in did not load, refresh the page" : "Sign-in was cancelled");
    return;
  }
  armExpiry();
  await connect();
}

export async function connect() {
  set({ conn: "connecting" });
  try {
    const fid = await drive.ensureFolder();
    if (fid !== folderId) {
      folderId = fid;
      libFileId = thumbsFileId = libModified = thumbsModified = null;
      dirtyLib = dirtyThumbs = false;
      set({ items: [], thumbs: {} });
    }
    const q = (n) => `name='${n}' and '${folderId}' in parents and trashed=false`;
    const [lf, tf] = await Promise.all([drive.findFile(q(LIB_NAME)), drive.findFile(q(THUMBS_NAME))]);

    if (lf) {
      libFileId = lf.id;
      if (!dirtyLib && lf.modifiedTime !== libModified) {
        const j = await drive.readJson(lf.id);
        set({ items: Array.isArray(j.items) ? j.items : [] });
        libModified = lf.modifiedTime;
      }
    } else if (!dirtyLib) { libFileId = null; set({ items: [] }); }

    if (tf) {
      thumbsFileId = tf.id;
      if (!dirtyThumbs && tf.modifiedTime !== thumbsModified) {
        set({ thumbs: (await drive.readJson(tf.id)) || {} });
        thumbsModified = tf.modifiedTime;
      }
    }

    snapshot(true);
    lastCheck = Date.now();
    set({ conn: "connected" });
    loadQuota();
    if (dirtyLib || dirtyThumbs) flush(); else set({ sync: "saved" });
  } catch (e) {
    if (e.auth) return;
    console.error(e);
    set({ conn: "error" });
    toast("Could not reach Google Drive");
  }
}

async function loadQuota() {
  try {
    const q = await drive.getQuota();
    set({ quotaText: q.limit ? `Drive: ${fmtSize(+q.usage || 0)} of ${fmtSize(+q.limit)} used` : "" });
  } catch {}
}

/* ---------- saving to Drive ---------- */
function scheduleSave(withThumbs) {
  dirtyLib = true;
  if (withThumbs) dirtyThumbs = true;
  set({ sync: "pending" });
  snapshot(!!withThumbs);
  clearTimeout(saveT);
  saveT = setTimeout(flush, 1200);
}

async function saveJson(fileId, name, data) {
  try {
    return fileId ? await drive.updateJson(fileId, data) : await drive.createJson(name, data, folderId);
  } catch (e) {
    if (e.status === 404) return drive.createJson(name, data, folderId);
    throw e;
  }
}

export async function flush() {
  clearTimeout(saveT);
  if (saving) { saveT = setTimeout(flush, 700); return; }
  if (!dirtyLib && !dirtyThumbs) { set({ sync: "saved" }); return; }
  if (state.conn !== "connected" || !drive.haveToken()) { set({ sync: "pending" }); return; }

  saving = true;
  set({ sync: "saving" });
  try {
    if (dirtyThumbs) {
      dirtyThumbs = false;
      try {
        const r = await saveJson(thumbsFileId, THUMBS_NAME, state.thumbs);
        thumbsFileId = r.id; thumbsModified = r.modifiedTime;
      } catch (e) { dirtyThumbs = true; throw e; }
    }
    if (dirtyLib) {
      dirtyLib = false;
      try {
        const r = await saveJson(libFileId, LIB_NAME, { version: 1, updated: Date.now(), items: state.items });
        libFileId = r.id; libModified = r.modifiedTime;
      } catch (e) { dirtyLib = true; throw e; }
    }
    saving = false;
    snapshot(false);
    if (dirtyLib || dirtyThumbs) { set({ sync: "pending" }); saveT = setTimeout(flush, 500); }
    else set({ sync: "saved" });
  } catch (e) {
    saving = false;
    if (e.auth) set({ sync: "pending" });
    else { console.error(e); set({ sync: "error" }); saveT = setTimeout(flush, 6000); }
  }
}

/* Pick up changes made on another device */
export async function refreshFromDrive(manual) {
  if (state.conn !== "connected" || dirtyLib || dirtyThumbs || saving || uploading || modalOpen || !libFileId) return;
  lastCheck = Date.now();
  try {
    let changed = false;
    const lm = await drive.getModifiedTime(libFileId);
    if (lm !== libModified) {
      const j = await drive.readJson(libFileId);
      if (dirtyLib || modalOpen) return;
      set({ items: Array.isArray(j.items) ? j.items : [] });
      libModified = lm; changed = true;
    }
    if (thumbsFileId) {
      const tm = await drive.getModifiedTime(thumbsFileId);
      if (tm !== thumbsModified) {
        set({ thumbs: (await drive.readJson(thumbsFileId)) || {} });
        thumbsModified = tm; changed = true;
      }
    }
    if (changed) { snapshot(true); toast("Updated with changes from your other device"); }
    else if (manual) toast("Everything is saved and up to date ✓");
  } catch (e) {
    if (e.status === 404) connect();
  }
}

export function syncButtonClick() {
  const { conn, sync } = state;
  if (conn === "setup") { toast("Add your Google Client ID first (see the setup steps)"); return; }
  if (conn === "connecting") return;
  if (conn === "connected") { if (sync === "error" || sync === "pending") flush(); else refreshFromDrive(true); return; }
  if (conn === "error" && drive.haveToken()) { connect(); return; }
  signInAndConnect();
}

/* ---------- clip actions ---------- */
export function updateItem(id, patch) {
  set({ items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  scheduleSave();
}

export function toggleFav(id) {
  const it = byId(id);
  if (it) updateItem(id, { fav: !it.fav });
}

export function markUsed(id, quiet) {
  const it = byId(id);
  if (!it) return;
  const uses = (it.uses || 0) + 1;
  updateItem(id, { uses, lastUsed: Date.now() });
  if (!quiet) toast(`Marked as used (${uses}x)`);
}

export function renameItem(id, name) {
  updateItem(id, { name });
  clearTimeout(renameTimers[id]);
  renameTimers[id] = setTimeout(async () => {
    const it = byId(id);
    if (!it) return;
    const ext = ((it.fileName || "").match(/\.[^.]+$/) || [""])[0];
    const newName = it.name.replace(/[\\/:*?"<>|]/g, "-") + ext;
    if (newName === it.fileName) return;
    try { await drive.renameFile(id, newName); updateItem(id, { fileName: newName }); } catch {}
  }, 1500);
}

function forget(id) {
  const thumbs = { ...state.thumbs };
  delete thumbs[id];
  cacheDel(id);
  const u = blobUrls.get(id);
  if (u) { URL.revokeObjectURL(u); blobUrls.delete(id); }
  set({ items: state.items.filter((i) => i.id !== id), thumbs });
  scheduleSave(true);
}

export async function deleteItem(id) {
  try { await drive.trashFile(id); }
  catch (e) {
    if (e.auth) return false;
    if (e.status !== 404) { toast("Could not delete, try again"); return false; }
  }
  forget(id);
  toast("Moved to Drive trash");
  return true;
}

/* ---------- playing / downloading media ---------- */
export const cachedUrl = (id) => blobUrls.get(id);

export async function getMediaUrl(it) {
  if (blobUrls.has(it.id)) return blobUrls.get(it.id);
  if (inflight.has(it.id)) return inflight.get(it.id);
  const p = (async () => {
    let blob = await cacheGet(it.id);
    if (!blob) {
      blob = await drive.downloadFile(it.id);
      if (it.mime && blob.type !== it.mime) blob = new Blob([blob], { type: it.mime });
      cachePut(it.id, blob);
    }
    const u = URL.createObjectURL(blob);
    blobUrls.set(it.id, u);
    return u;
  })();
  inflight.set(it.id, p);
  try { return await p; } finally { inflight.delete(it.id); }
}

export function mediaErr(id, e, quiet) {
  if (e?.auth) {
    if (!quiet) toast(state.conn === "setup" ? "Finish the Google setup first" : "Connect Google Drive to load this clip");
    return;
  }
  if (e?.status === 404) {
    const it = byId(id);
    forget(id);
    toast(`"${it?.name || "Clip"}" was deleted from Drive, removed from the vault`);
    return;
  }
  toast("Could not load this clip from Drive");
}

export async function download(it) {
  let url = blobUrls.get(it.id);
  if (!url) {
    toast("Getting it from Drive...");
    try { url = await getMediaUrl(it); } catch (e) { mediaErr(it.id, e); return; }
  }
  const a = document.createElement("a");
  a.href = url; a.download = it.fileName || it.name;
  document.body.appendChild(a); a.click(); a.remove();
  markUsed(it.id);
}

// Drag a clip from the browser onto the Desktop or a folder (Chrome / Edge)
export function dragStart(e, it) {
  internalDrag = true;
  const u = blobUrls.get(it.id);
  if (u) {
    try { e.dataTransfer.setData("DownloadURL", `${it.mime}:${(it.fileName || it.name).replace(/:/g, "-")}:${u}`); } catch {}
    markUsed(it.id, true);
  } else {
    toast("Loading from Drive, try dragging again in a second");
    getMediaUrl(it).catch((err) => mediaErr(it.id, err));
  }
  e.dataTransfer.setData("text/plain", it.name);
  e.dataTransfer.effectAllowed = "copy";
}
export const dragEnd = () => { internalDrag = false; };

/* ---------- adding clips ---------- */
export async function addFiles(fileList) {
  if (state.conn !== "connected" || !drive.haveToken()) {
    toast(state.conn === "expired" ? "Reconnect Drive first, then add clips" : "Connect Google Drive first");
    return [];
  }
  const files = [...fileList].filter((f) => kindOf(f));
  if (!files.length) { toast("Only video, audio and image files can be added"); return []; }

  uploading = true;
  const added = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i], kind = kindOf(f), label = `(${i + 1} of ${files.length}) ${f.name}`;
    set({ upload: { text: "Preparing " + label, p: 0 } });

    let meta = {};
    try {
      if (kind === "video") meta = await videoMeta(f);
      else if (kind === "audio") meta = await audioMeta(f);
      else meta = await imageMeta(f);
    } catch {}

    try {
      const res = await drive.uploadMedia(f, folderId, (p) => set({ upload: { text: "Uploading " + label, p } }));
      const it = {
        id: res.id, name: f.name.replace(/\.[^.]+$/, ""), fileName: f.name, kind,
        mime: f.type || "application/octet-stream", size: f.size,
        tags: [], notes: "", fav: false, uses: 0, lastUsed: null, added: Date.now() + i,
        duration: meta.duration || null, peaks: meta.peaks || null,
      };
      cachePut(it.id, f);
      set({
        items: [...state.items, it],
        thumbs: meta.thumb ? { ...state.thumbs, [it.id]: meta.thumb } : state.thumbs,
      });
      added.push(it.id);
    } catch (e) {
      if (e.auth) { toast("Drive session ended. Reconnect and add the rest again"); break; }
      console.error(e);
      toast("Failed to upload " + f.name);
    }
  }
  uploading = false;
  set({ upload: null });

  if (added.length) {
    scheduleSave(true);
    loadQuota();
    toast(`Added ${added.length} to Drive 🎉 Now tag them`);
  }
  return added;
}

/* ---------- footer actions ---------- */
export async function clearDeviceCache() {
  await clearStore("blobs");
  blobUrls.forEach((u) => URL.revokeObjectURL(u));
  blobUrls.clear();
  toast("Device cache cleared. Your clips are still safe in Drive");
}

export async function signOut() {
  if (dirtyLib || dirtyThumbs) { toast("Wait a moment, still saving to Drive"); flush(); return; }
  if (!confirm("Sign out on this device? Your clips stay safe in Google Drive.")) return;
  drive.revokeAccess();
  lsSet("mv-was-signed", null);
  folderId = libFileId = thumbsFileId = libModified = thumbsModified = null;
  await clearStore("blobs");
  await clearStore("kv");
  blobUrls.forEach((u) => URL.revokeObjectURL(u));
  blobUrls.clear();
  set({ items: [], thumbs: {}, quotaText: "", conn: "signedout", sync: "saved" });
}
