"use client";

import { useEffect, useState } from "react";

export default function Toast({ toast }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2400);
    return () => clearTimeout(t);
  }, [toast]);
  return <div className={`toast${show ? " show" : ""}`}>{toast?.msg}</div>;
}
