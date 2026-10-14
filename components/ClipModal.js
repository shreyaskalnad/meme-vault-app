"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Wave from "./Wave";
import * as vault from "@/lib/vaultStore";
import { PRESET_TAGS } from "@/lib/config";
import { ago, fmtDur, fmtSize, isTyping, normTag } from "@/lib/utils";

const KIND_NAME = { video: "Meme clip", audio: "Sound effect", image: "Image" };

function Preview({ item, thumb }) {
  const [url, setUrl] = useState(null);
  const mediaRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    vault.getMediaUrl(item).then((u) => { if (alive) setUrl(u); }).catch((e) => vault.mediaErr(item.id, e));
    return () => { alive = false; };
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = mediaRef.current;
    if (m) m.play().catch(() => {});
    return () => { if (m) { m.pause(); m.removeAttribute("src"); m.load(); } };
  }, [url]);

  if (!url) {
    return (
      <div className="mprev loading">
        {item.kind === "audio" ? <div className="audiobox"><Wave item={item} /></div>
          : thumb ? <img src={thumb} alt="" style={{ opacity: 0.4 }} /> : null}
      </div>
    );
  }
  return (
    <div className="mprev">
      {item.kind === "video" && <video ref={mediaRef} src={url} controls loop playsInline />}
      {item.kind === "audio" && (
        <div className="audiobox"><Wave item={item} /><audio ref={mediaRef} src={url} controls /></div>
      )}
      {item.kind === "image" && <img src={url} alt="" />}
    </div>
  );
}

export default function ClipModal({ ids, idx, setIdx, items, thumbs, onClose }) {
  const item = items.find((i) => i.id === ids[idx]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [tagText, setTagText] = useState("");
  const notesTimer = useRef(null);
  const tagInput = useRef(null);
  const id = item?.id;

  // Reset the form when moving to another clip
  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setNotes(item.notes || "");
    setTagText("");
    if (!item.tags.length) setTimeout(() => tagInput.current?.focus(), 50);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => {
    if (!item) return [];
    const freq = {};
    items.forEach((i) => i.tags.forEach((t) => (freq[t] = (freq[t] || 0) + 1)));
    PRESET_TAGS.forEach((t) => (freq[t] = (freq[t] || 0) + 0.5));
    return Object.keys(freq).filter((t) => !item.tags.includes(t)).sort((a, b) => freq[b] - freq[a]).slice(0, 22);
  }, [items, item]);

  const canBack = idx > 0, canFwd = idx < ids.length - 1;
  const back = () => canBack && setIdx(idx - 1);
  const fwd = () => canFwd && setIdx(idx + 1);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (isTyping()) return;
      if (e.key === "ArrowRight") fwd();
      if (e.key === "ArrowLeft") back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!item) return null;

  function addTag(raw) {
    const tags = [...item.tags];
    raw.split(",").map(normTag).filter(Boolean).forEach((t) => { if (!tags.includes(t)) tags.push(t); });
    vault.updateItem(item.id, { tags });
  }
  function removeTag(t) {
    vault.updateItem(item.id, { tags: item.tags.filter((x) => x !== t) });
  }
  function onTagKey(e) {
    if ((e.key === "Enter" || e.key === ",") && tagText.trim()) {
      e.preventDefault(); addTag(tagText); setTagText("");
    } else if (e.key === "Enter" && !tagText.trim() && item.tags.length && canFwd) {
      e.preventDefault(); fwd();
    } else if (e.key === "Backspace" && !tagText && item.tags.length) {
      removeTag(item.tags[item.tags.length - 1]);
    }
  }
  function onNotes(v) {
    setNotes(v);
    clearTimeout(notesTimer.current);
    const clipId = item.id;
    notesTimer.current = setTimeout(() => vault.updateItem(clipId, { notes: v }), 300);
  }
  async function onDelete() {
    if (!confirm(`Delete "${item.name}"? It will move to your Google Drive trash.`)) return;
    await vault.deleteItem(item.id); // the parent removes it from the list
  }

  return (
    <div className="mback" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="mx" title="Close (Esc)" onClick={onClose}>✕</button>
        <Preview key={item.id} item={item} thumb={thumbs[item.id]} />
        <div className="mside">
          <input
            className="mname" spellCheck={false} value={name}
            onChange={(e) => { setName(e.target.value); const v = e.target.value.trim(); if (v) vault.renameItem(item.id, v); }}
          />

          <div className="lbl">Tags <small>which moments does this fit?</small></div>
          <div className="tagbox" onClick={() => tagInput.current?.focus()}>
            {item.tags.map((t) => (
              <span key={t} className="tg">#{t}<button title="Remove" onClick={() => removeTag(t)}>✕</button></span>
            ))}
            <input
              ref={tagInput} placeholder="type a tag + Enter" value={tagText}
              onChange={(e) => setTagText(e.target.value)} onKeyDown={onTagKey}
              onBlur={() => { if (tagText.trim()) { addTag(tagText); setTagText(""); } }}
            />
          </div>
          <div className="suggest">
            {suggestions.map((t) => <button key={t} onClick={() => addTag(t)}>+ {t}</button>)}
          </div>

          <div className="lbl">Notes</div>
          <textarea
            placeholder="e.g. use right after the punchline, works with a zoom-in"
            value={notes} onChange={(e) => onNotes(e.target.value)}
          />

          <div className="mstats">
            {KIND_NAME[item.kind]} · {fmtSize(item.size)}{item.duration ? " · " + fmtDur(item.duration) : ""} · used {item.uses}x · last used {ago(item.lastUsed)}
          </div>

          <div className="mactions">
            <button className="btn primary" onClick={() => vault.download(item)}>⬇ Download</button>
            <button className="btn" onClick={() => vault.toggleFav(item.id)}>{item.fav ? "★ Favorited" : "☆ Favorite"}</button>
            <button className="btn" onClick={() => vault.markUsed(item.id)}>✓ Mark used</button>
            <button className="btn danger" onClick={onDelete}>Delete</button>
          </div>

          <div className="dragme" draggable onDragStart={(e) => vault.dragStart(e, item)} onDragEnd={vault.dragEnd}>
            ⠿ Drag this onto your Desktop or a folder
          </div>

          <div className="mnav">
            <button className="btn" onClick={back} disabled={!canBack}>← Prev</button>
            <span>{idx + 1} / {ids.length}</span>
            <button className="btn" onClick={fwd} disabled={!canFwd}>{canFwd && !item.tags.length ? "Skip →" : "Next →"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
