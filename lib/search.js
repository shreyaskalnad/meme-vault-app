import { STOP, SYN } from "./config";

export function tokenize(q) {
  return q.toLowerCase().split(/[^a-z0-9-]+/).filter((t) => t && !STOP.has(t));
}

function stem(t) {
  return t.replace(/(ing|ed|es|s)$/, "").replace(/(.)\1$/, "$1");
}

function expand(t) {
  const s = stem(t), set = new Set([t]);
  if (s.length >= 3) set.add(s);
  for (const k of [t, s]) (SYN[k] || []).forEach((x) => set.add(x));
  return set;
}

function scoreItem(it, tokens) {
  if (!tokens.length) return 1;
  const name = it.name.toLowerCase(), notes = (it.notes || "").toLowerCase();
  let total = 0;
  for (const tk of tokens) {
    let best = 0;
    for (const e of expand(tk)) {
      const direct = e === tk || e === stem(tk);
      for (const t of it.tags) {
        if (t === e) best = Math.max(best, direct ? 6 : 4);
        else if (e.length >= 3 && (t.includes(e) || e.includes(t))) best = Math.max(best, direct ? 3 : 2);
      }
      if (e.length >= 3 && name.includes(e)) best = Math.max(best, direct ? 3 : 2);
      if (e.length >= 3 && notes.includes(e)) best = Math.max(best, 1);
    }
    total += best;
  }
  return total;
}

export function matchedTags(it, tokens) {
  const hits = new Set();
  for (const tk of tokens)
    for (const e of expand(tk))
      for (const t of it.tags)
        if (t === e || (e.length >= 3 && (t.includes(e) || e.includes(t)))) hits.add(t);
  return hits;
}

export function filterAndSort(items, { tokens, type, favOnly, untagged, sort }) {
  let list = items.filter((it) => type === "all" || it.kind === type);
  if (favOnly) list = list.filter((i) => i.fav);
  if (untagged) list = list.filter((i) => !i.tags.length);
  let scored = list.map((it) => ({ it, s: scoreItem(it, tokens) }));
  if (tokens.length) scored = scored.filter((x) => x.s > 0);
  scored.sort((a, b) => {
    if (sort === "best") {
      if (tokens.length) return b.s - a.s || a.it.uses - b.it.uses || (a.it.lastUsed || 0) - (b.it.lastUsed || 0);
      return b.it.added - a.it.added;
    }
    if (sort === "new") return b.it.added - a.it.added;
    if (sort === "least") return a.it.uses - b.it.uses || b.it.added - a.it.added;
    if (sort === "most") return b.it.uses - a.it.uses;
    return a.it.name.localeCompare(b.it.name);
  });
  return scored.map((x) => x.it);
}
