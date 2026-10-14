"use client";

import { useEffect, useRef, useState } from "react";
import Wave from "./Wave";
import * as vault from "@/lib/vaultStore";
import { DAY, ago, fmtDur } from "@/lib/utils";

const LABEL = { video: "MEME", audio: "SFX", image: "IMG" };

function HoverVideo({ url, sound }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    v.muted = !sound;
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    return () => { v.pause(); v.removeAttribute("src"); v.load(); };
  }, [url, sound]);
  return <video ref={ref} className="hoverv" src={url} loop playsInline muted />;
}

export default function ClipCard({ item, thumb, hits, playing, audioLoading, sound, onOpen, onPlay }) {
  const [hoverUrl, setHoverUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const hovering = useRef(false);

  async function onEnter(e) {
    if (e.pointerType !== "mouse") return;
    hovering.current = true;
    if (item.kind !== "video") {
      // pre-load so dragging works straight away
      if (!vault.cachedUrl(item.id)) vault.getMediaUrl(item).catch(() => {});
      return;
    }
    let url = vault.cachedUrl(item.id);
    if (!url) {
      setLoading(true);
      try { url = await vault.getMediaUrl(item); }
      catch (err) { setLoading(false); vault.mediaErr(item.id, err, true); return; }
      setLoading(false);
    }
    if (hovering.current) setHoverUrl(url);
  }
  function onLeave() {
    hovering.current = false;
    setLoading(false);
    setHoverUrl(null);
  }

  const shownTags = [...item.tags].sort((a, b) => hits.has(b) - hits.has(a)).slice(0, 4);
  const recent = item.lastUsed && Date.now() - item.lastUsed < 3 * DAY;

  return (
    <article
      className={`card k-${item.kind}${playing ? " playing" : ""}`}
      draggable
      onClick={() => onOpen(item.id)}
      onDragStart={(e) => vault.dragStart(e, item)}
      onDragEnd={vault.dragEnd}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <div className={`thumb${loading || audioLoading ? " loading" : ""}`}>
        {item.kind === "audio" ? (
          <>
            <Wave item={item} />
            <button className="play" title="Play" onClick={(e) => { e.stopPropagation(); onPlay(item); }}>
              {playing ? "❚❚" : "▶"}
            </button>
          </>
        ) : thumb ? (
          <img src={thumb} alt="" />
        ) : (
          <div className="noprev">{item.kind === "video" ? "🎬" : "🖼"}</div>
        )}
        {hoverUrl && <HoverVideo url={hoverUrl} sound={sound} />}
        <span className="kind">{LABEL[item.kind]}</span>
        <button
          className={`fav${item.fav ? " on" : ""}`}
          title="Favorite"
          onClick={(e) => { e.stopPropagation(); vault.toggleFav(item.id); }}
        >
          {item.fav ? "★" : "☆"}
        </button>
        {item.duration ? <span className="dur">{fmtDur(item.duration)}</span> : null}
      </div>
      <div className="cbody">
        <div className="cname" title={item.name}>{item.name}</div>
        <div className="ctags">
          {item.tags.length ? (
            <>
              {shownTags.map((t) => (
                <span key={t} className={`tg${hits.has(t) ? " hit" : ""}`}>#{t}</span>
              ))}
              {item.tags.length > 4 && <span className="tg">+{item.tags.length - 4}</span>}
            </>
          ) : (
            <span className="tg none">needs tags</span>
          )}
        </div>
        <div className="cmeta">
          <span>used {item.uses}x</span>
          {recent && <span className="recent">● used {ago(item.lastUsed)}</span>}
        </div>
      </div>
    </article>
  );
}
