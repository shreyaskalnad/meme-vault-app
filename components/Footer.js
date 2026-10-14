"use client";

import * as vault from "@/lib/vaultStore";
import { fmtSize } from "@/lib/utils";

export default function Footer({ items, conn, quotaText }) {
  const total = items.reduce((a, i) => a + (i.size || 0), 0);
  return (
    <footer>
      {items.length
        ? `${items.length} items · ${fmtSize(total)} in the "Meme Vault" folder of your Google Drive`
        : `Clips are saved in a "Meme Vault" folder in your Google Drive.`}
      {quotaText ? ` · ${quotaText}` : ""}
      {(conn === "connected" || conn === "expired") && (
        <>
          <br />
          <button className="link" onClick={vault.clearDeviceCache}>Clear this device&apos;s cache</button>
          {" · "}
          <button className="link" onClick={vault.signOut}>Sign out</button>
        </>
      )}
    </footer>
  );
}
