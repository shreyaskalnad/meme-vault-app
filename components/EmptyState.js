"use client";

import * as vault from "@/lib/vaultStore";

export default function EmptyState({ hasItems, conn, query, onAdd }) {
  if (hasItems) {
    return (
      <div className="empty">
        <div className="big">🤷</div>
        <h2>Nothing fits {query ? `"${query}"` : "these filters"}</h2>
        <div>Try a different word, or tag more clips with this kind of moment.</div>
      </div>
    );
  }
  if (conn === "setup") {
    return (
      <div className="empty">
        <div className="big">⚙️</div>
        <h2>One step left</h2>
        <div>Add <b>NEXT_PUBLIC_GOOGLE_CLIENT_ID</b> in Vercel (Settings, Environment Variables) or in <b>.env.local</b> on your PC, then redeploy or restart.</div>
      </div>
    );
  }
  if (conn === "signedout" || conn === "expired") {
    return (
      <div className="empty">
        <div className="big">☁️</div>
        <h2>Connect your Google Drive</h2>
        <div>Your clips are saved in a <b>Meme Vault</b> folder in your Drive, so they stay safe and show up on every device.</div>
        <button className="btn primary" onClick={vault.signInAndConnect}>Connect Google Drive</button>
      </div>
    );
  }
  if (conn === "connecting") {
    return <div className="empty"><div className="big">⏳</div><h2>Loading your vault from Drive...</h2></div>;
  }
  if (conn === "error") {
    return (
      <div className="empty">
        <div className="big">⚠️</div>
        <h2>Could not reach Google Drive</h2>
        <div>Check your internet, then try again.</div>
        <button className="btn primary" onClick={vault.connect}>Try again</button>
      </div>
    );
  }
  return (
    <div className="empty">
      <div className="big">🗃️</div>
      <h2>Your vault is empty</h2>
      <div>Drop your meme clips, sound effects and reaction images anywhere on this page.</div>
      <button className="btn primary" onClick={onAdd}>＋ Add clips</button>
    </div>
  );
}
