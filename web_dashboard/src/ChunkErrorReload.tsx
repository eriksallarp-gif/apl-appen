"use client";
import { useEffect } from "react";

export default function ChunkErrorReload() {
  useEffect(() => {
    const handler = (event) => {
      // Next.js chunkloaderror reload
      if (
        event?.type === "error" &&
        event?.message && event.message.includes("ChunkLoadError")
      ) {
        window.location.reload();
      }
    };
    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, []);
  return null;
}
