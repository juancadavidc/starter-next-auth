"use client";

import { useEffect } from "react";

// Solo en producción: en desarrollo un SW cacheando chunks confunde el hot reload.
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);
  return null;
}
