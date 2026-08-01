"use client";
import { useEffect } from "react";

export default function ChunkErrorReload() {
  useEffect(() => {
    const reloadKey = "apl_chunk_reload_done";

    const reloadOnce = () => {
      if (sessionStorage.getItem(reloadKey) === "1") {
        return;
      }

      sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
    };

    const handler = (event: any) => {
      const message = String(event?.message || "");
      const chunkFailed = message.includes("ChunkLoadError") || message.includes("Loading chunk");
      const webpackRuntimeFailed =
        message.includes("Cannot read properties of undefined") && message.includes("reading 'call'");

      if (event?.type === "error" && (chunkFailed || webpackRuntimeFailed)) {
        reloadOnce();
      }
    };

    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const reasonText =
        typeof reason === "string"
          ? reason
          : String(reason?.message || reason || "");

      if (
        reasonText.includes("ChunkLoadError") ||
        reasonText.includes("Loading chunk") ||
        (reasonText.includes("Cannot read properties of undefined") && reasonText.includes("reading 'call'"))
      ) {
        reloadOnce();
      }
    };

    // Clear the one-time flag after a successful page load cycle.
    const clearReloadFlag = () => {
      sessionStorage.removeItem(reloadKey);
    };

    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", unhandledRejectionHandler);
    window.addEventListener("pageshow", clearReloadFlag);

    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", unhandledRejectionHandler);
      window.removeEventListener("pageshow", clearReloadFlag);
    };
  }, []);

  return null;
}
