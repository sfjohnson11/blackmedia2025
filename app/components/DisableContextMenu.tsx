"use client";

import { useEffect } from "react";

export default function DisableContextMenu() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd+U (view source)
      if (ctrlOrCmd && key === "u") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Ctrl/Cmd+Shift+I/J/C (devtools shortcuts)
      if (ctrlOrCmd && e.shiftKey && (key === "i" || key === "j" || key === "c")) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // F12
      if (e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("contextmenu", onContextMenu, { capture: true });
    document.addEventListener("keydown", onKeyDown, { capture: true });

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, { capture: true } as any);
      document.removeEventListener("keydown", onKeyDown, { capture: true } as any);
    };
  }, []);

  return null; // ✅ renders nothing, so it will NOT block clicking
}
