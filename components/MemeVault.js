"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as vault from "@/lib/vaultStore";
import { filterAndSort, matchedTags, tokenize } from "@/lib/search";
import { isTyping, lsGet, lsSet } from "@/lib/utils";
import Header from "./Header";
import FilterBar from "./FilterBar";
import ClipCard from "./ClipCard";
import ClipModal from "./ClipModal";
import EmptyState from "./EmptyState";
import Footer from "./Footer";
import Toast from "./Toast";

export default function MemeVault() {
  const { items, thumbs, conn, sync, quotaText, upload, toast } = vault.useVault();

  // search + filters
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [favOnly, setFavOnly] = useState(false);
  const [untagged, setUntagged] = useState(false);
  const [sort, setSort] = useState("best");
  const [sound, setSound] = useState(() => lsGet("mv-sound", false));

  // modal, audio player, drag-and-drop
  const [modal, setModal] = useState(null); // { ids, idx }
  const [playingId, setPlayingId] = useState(null);
  const [audioLoadingId, setAudioLoadingId] = useState(null);
  const [dropOver, setDropOver] = useState(false);
  const searchRef = useRef(null);
  const fileRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    vault.init();
    const p = new Audio();
    p.onended = () => setPlayingId(null);
    playerRef.current = p;
    return () => p.pause();
  }, []);

  const tokens = useMemo(() => tokenize(query), [query]);
  const view = useMemo(
    () => filterAndSort(items, { tokens, type, favOnly, untagged, sort }),
    [items, tokens, type, favOnly, untagged, sort]
  );
  const untaggedCount = useMemo(() => items.filter((i) => !i.tags.length).length, [items]);

  // keep the modal list in step with the library (e.g. after a delete)
  useEffect(() => {
    vault.setModalOpen(!!modal);
    if (!modal) return;
    const live = modal.ids.filter((id) => items.some((i) => i.id === id));
    if (!live.length) setModal(null);
    else if (live.length !== modal.ids.length) setModal({ ids: live, idx: Math.min(modal.idx, live.length - 1) });
  }, [items, modal]);

  // "/" jumps to search
  useEffect(() => {
    function onKey(e) {
      if (modal) return;
      if (e.key === "/" && !isTyping()) { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);

  // drop files anywhere on the page
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e) => !vault.isInternalDrag() && [...(e.dataTransfer?.types || [])].includes("Files");
    const enter = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDropOver(true); };
    const over = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const leave = (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setDropOver(false); };
    const drop = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; setDropOver(false); importFiles(e.dataTransfer.files); };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopAudio() {
    playerRef.current?.pause();
    setPlayingId(null);
  }
  function openModal(ids, idx) {
    stopAudio();
    setModal({ ids, idx });
  }
  async function importFiles(files) {
    const added = await vault.addFiles(files);
    if (added.length) openModal(added, 0);
  }
  function onAdd() {
    if (conn !== "connected") {
      vault.toast(conn === "expired" ? "Reconnect Drive first" : "Connect Google Drive first");
      return;
    }
    fileRef.current?.click();
  }
  function toggleSound() {
    setSound((s) => { lsSet("mv-sound", !s); return !s; });
  }
  async function playAudio(item) {
    const p = playerRef.current;
    if (playingId === item.id && !p.paused) { stopAudio(); return; }
    let url = vault.cachedUrl(item.id);
    if (!url) {
      setAudioLoadingId(item.id);
      try { url = await vault.getMediaUrl(item); }
      catch (e) { setAudioLoadingId(null); vault.mediaErr(item.id, e); return; }
      setAudioLoadingId(null);
    }
    p.src = url;
    p.currentTime = 0;
    p.play().catch(() => {});
    setPlayingId(item.id);
  }

  const viewIds = view.map((i) => i.id);

  return (
    <>
      <Header
        ref={searchRef} query={query} setQuery={setQuery} sound={sound} toggleSound={toggleSound}
        conn={conn} sync={sync} onAdd={onAdd}
      />
      <input
        ref={fileRef} type="file" multiple accept="video/*,audio/*,image/*" hidden
        onChange={(e) => { importFiles(e.target.files); e.target.value = ""; }}
      />
      <FilterBar
        type={type} setType={setType} favOnly={favOnly} setFavOnly={setFavOnly}
        untagged={untagged} setUntagged={setUntagged} untaggedCount={untaggedCount}
        sort={sort} setSort={setSort} shown={view.length} total={items.length}
      />

      <main>
        {view.length ? (
          <div className="grid">
            {view.map((it) => (
              <ClipCard
                key={it.id} item={it} thumb={thumbs[it.id]} hits={matchedTags(it, tokens)}
                playing={playingId === it.id} audioLoading={audioLoadingId === it.id} sound={sound}
                onOpen={(id) => openModal(viewIds, viewIds.indexOf(id))}
                onPlay={playAudio}
              />
            ))}
          </div>
        ) : (
          <EmptyState hasItems={items.length > 0} conn={conn} query={query.trim()} onAdd={onAdd} />
        )}
      </main>

      <Footer items={items} conn={conn} quotaText={quotaText} />

      {dropOver && <div id="drop"><div>Drop clips, sounds or images to add them 🎉</div></div>}

      {upload && (
        <div id="upPanel">
          <div id="upText">{upload.text}</div>
          <div className="pbar"><i style={{ width: Math.round(upload.p * 100) + "%" }} /></div>
        </div>
      )}

      {modal && (
        <ClipModal
          ids={modal.ids} idx={modal.idx} setIdx={(idx) => setModal((m) => ({ ...m, idx }))}
          items={items} thumbs={thumbs} onClose={() => setModal(null)}
        />
      )}

      <Toast toast={toast} />
    </>
  );
}
