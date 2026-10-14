import { EXT } from "./config";

export const DAY = 864e5;

export const fmtDur = (s) => {
  if (s == null || !isFinite(s)) return "";
  s = Math.round(s);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

export const fmtSize = (b) =>
  b > 1e9 ? (b / 1e9).toFixed(2) + " GB" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB";

export function ago(t) {
  if (!t) return "never";
  const d = Math.floor((Date.now() - t) / DAY);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago";
}

export function lsGet(k, d) {
  try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; }
}
export function lsSet(k, v) {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

export function kindOf(f) {
  if (f.type.startsWith("video/")) return "video";
  if (f.type.startsWith("audio/")) return "audio";
  if (f.type.startsWith("image/")) return "image";
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  for (const k in EXT) if (EXT[k].includes(ext)) return k;
  return null;
}

export const normTag = (t) => t.toLowerCase().trim().replace(/^#/, "").replace(/\s+/g, "-").slice(0, 30);

export const isTyping = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
