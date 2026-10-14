"use client";

import dynamic from "next/dynamic";

// The whole app uses browser-only things (Google sign-in, IndexedDB, video),
// so it renders only in the browser, never on the server.
const MemeVault = dynamic(() => import("@/components/MemeVault"), { ssr: false });

export default function Page() {
  return <MemeVault />;
}
