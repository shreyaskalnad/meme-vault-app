"use client";

import { forwardRef } from "react";
import { SITUATIONS } from "@/lib/config";
import * as vault from "@/lib/vaultStore";

function syncLabel(conn, sync) {
  if (conn === "setup") return ["⚙ Setup needed", "warn"];
  if (conn === "signedout") return ["Connect Google Drive", "go"];
  if (conn === "connecting") return ["☁ Connecting...", ""];
  if (conn === "expired") return ["↻ Reconnect Drive", "warn"];
  if (conn === "error") return ["⚠ Drive error, retry", "warn"];
  if (sync === "saving") return ["☁ Saving...", "ok"];
  if (sync === "pending") return ["☁ Saving soon", "ok"];
  if (sync === "error") return ["⚠ Save failed, retry", "warn"];
  return ["☁ Saved to Drive", "ok"];
}

const Header = forwardRef(function Header({ query, setQuery, sound, toggleSound, conn, sync, onAdd }, searchRef) {
  const [label, cls] = syncLabel(conn, sync);
  const q = query.trim().toLowerCase();

  return (
    <header>
      <div className="top">
        <div className="logo">MEME <span>VAULT</span></div>
        <div className="search">
          <input
            ref={searchRef} type="search" autoComplete="off" value={query}
            placeholder="What's happening in this moment? e.g. friend gets roasted"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); e.currentTarget.blur(); } }}
          />
          <kbd>/</kbd>
        </div>
        <button className="btn" id="soundBtn" title="Play sound when hovering video clips" onClick={toggleSound}>
          {sound ? "🔊 Hover sound" : "🔇 Hover muted"}
        </button>
        <button className={`btn sync ${cls}`} onClick={vault.syncButtonClick}>{label}</button>
        <button className="btn primary" onClick={onAdd}>＋ Add clips</button>
      </div>
      <div className="chips">
        {SITUATIONS.map(([text, tag]) => (
          <button key={tag} className={`chip${q === tag ? " on" : ""}`} onClick={() => setQuery(q === tag ? "" : tag)}>
            {text}
          </button>
        ))}
      </div>
    </header>
  );
});

export default Header;
