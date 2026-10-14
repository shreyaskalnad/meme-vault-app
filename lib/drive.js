// Google sign-in + Google Drive API calls.
import { CLIENT_ID, SCOPE, FOLDER_NAME, DRIVE, UPLOAD } from "./config";
import { lsSet, lsGet } from "./utils";

export class AuthError extends Error {
  constructor() { super("auth"); this.auth = true; }
}

let token = null, tokenExp = 0, tokenClient = null, pendingAuth = null;
let onAuthLost = () => {};

export const setAuthLostHandler = (fn) => { onAuthLost = fn; };
export const haveToken = () => !!token && tokenExp > Date.now() + 20000;
export const getTokenExp = () => tokenExp;

export function loadSavedToken() {
  const t = lsGet("mv-token", null);
  if (t && t.exp > Date.now() + 60000) { token = t.token; tokenExp = t.exp; return true; }
  return false;
}
export function clearToken() {
  token = null; tokenExp = 0; lsSet("mv-token", null);
}
function authFail() { clearToken(); onAuthLost(); }

function loadGisScript() {
  return new Promise((res, rej) => {
    if (window.google?.accounts?.oauth2) return res();
    if (!document.querySelector("script[data-gis]")) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.dataset.gis = "1";
      document.head.appendChild(s);
    }
    const t0 = Date.now();
    const check = () => {
      if (window.google?.accounts?.oauth2) res();
      else if (Date.now() - t0 > 15000) rej(new Error("gis"));
      else setTimeout(check, 100);
    };
    check();
  });
}

export async function initAuth() {
  await loadGisScript();
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (r) => {
      if (r.error) { pendingAuth?.rej(new Error(r.error)); pendingAuth = null; return; }
      token = r.access_token;
      tokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000;
      lsSet("mv-token", { token, exp: tokenExp });
      lsSet("mv-was-signed", true);
      pendingAuth?.res(); pendingAuth = null;
    },
    error_callback: (e) => { pendingAuth?.rej(new Error(e?.type || "popup_closed")); pendingAuth = null; },
  });
}

export function signIn() {
  return new Promise((res, rej) => {
    if (!tokenClient) return rej(new Error("gis"));
    pendingAuth = { res, rej };
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

export function revokeAccess() {
  try { if (token) window.google.accounts.oauth2.revoke(token, () => {}); } catch {}
  clearToken();
}

export async function api(url, opts = {}) {
  if (!haveToken()) { if (token) authFail(); throw new AuthError(); }
  const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: "Bearer " + token } });
  if (r.status === 401) { authFail(); throw new AuthError(); }
  if (!r.ok) { const e = new Error("Drive error " + r.status); e.status = r.status; throw e; }
  return r;
}

const jsonHeaders = { "Content-Type": "application/json" };

export async function findFile(q) {
  const r = await api(`${DRIVE}?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&spaces=drive&pageSize=10&orderBy=modifiedTime desc`);
  const j = await r.json();
  return (j.files && j.files[0]) || null;
}

export async function ensureFolder() {
  let f = await findFile(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  if (!f) {
    const r = await api(DRIVE + "?fields=id", {
      method: "POST", headers: jsonHeaders,
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
    });
    f = await r.json();
  }
  return f.id;
}

export async function readJson(id) {
  const r = await api(`${DRIVE}/${id}?alt=media`);
  return r.json();
}

export async function getModifiedTime(id) {
  const r = await api(`${DRIVE}/${id}?fields=modifiedTime`);
  return (await r.json()).modifiedTime;
}

export async function createJson(name, obj, folderId) {
  const b = "mvb" + Math.random().toString(36).slice(2);
  const meta = { name, parents: [folderId], mimeType: "application/json" };
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(obj)}\r\n--${b}--`;
  const r = await api(`${UPLOAD}?uploadType=multipart&fields=id,modifiedTime`, {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` }, body,
  });
  return r.json();
}

export async function updateJson(id, obj) {
  const r = await api(`${UPLOAD}/${id}?uploadType=media&fields=id,modifiedTime`, {
    method: "PATCH", headers: jsonHeaders, body: JSON.stringify(obj),
  });
  return r.json();
}

export async function renameFile(id, name) {
  await api(`${DRIVE}/${id}?fields=id`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ name }) });
}

export async function trashFile(id) {
  await api(`${DRIVE}/${id}?fields=id`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ trashed: true }) });
}

export async function downloadFile(id) {
  const r = await api(`${DRIVE}/${id}?alt=media`);
  return r.blob();
}

export async function getQuota() {
  const r = await api("https://www.googleapis.com/drive/v3/about?fields=storageQuota");
  return (await r.json()).storageQuota || {};
}

function xhrUpload(url, method, body, contentType, onProg) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    x.setRequestHeader("Authorization", "Bearer " + token);
    if (contentType) x.setRequestHeader("Content-Type", contentType);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProg(e.loaded / e.total); };
    x.onload = () => {
      if (x.status === 401) { authFail(); rej(new AuthError()); return; }
      if (x.status >= 200 && x.status < 300) {
        try { res(JSON.parse(x.responseText)); } catch { rej(new Error("Bad upload response")); }
      } else { const e = new Error("Upload failed " + x.status); e.status = x.status; rej(e); }
    };
    x.onerror = () => rej(new Error("Network error"));
    x.send(body);
  });
}

export async function uploadMedia(file, folderId, onProg) {
  if (!haveToken()) { if (token) authFail(); throw new AuthError(); }
  const type = file.type || "application/octet-stream";
  const meta = { name: file.name, parents: [folderId] };

  // Bigger files: resumable upload
  if (file.size > 5 * 1024 * 1024) {
    try {
      const r = await api(`${UPLOAD}?uploadType=resumable&fields=id,name,size`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": type },
        body: JSON.stringify(meta),
      });
      const loc = r.headers.get("Location");
      if (loc) return await xhrUpload(loc, "PUT", file, type, onProg);
    } catch (e) { if (e.auth) throw e; }
  }

  // Small files (or fallback): one-shot multipart upload
  const b = "mvb" + Math.random().toString(36).slice(2);
  const body = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n`,
    file,
    `\r\n--${b}--`,
  ]);
  return xhrUpload(`${UPLOAD}?uploadType=multipart&fields=id,name,size`, "POST", body, `multipart/related; boundary=${b}`, onProg);
}
