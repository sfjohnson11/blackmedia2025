"use client";

import { useEffect } from "react";

export default function DisableContextMenu() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Optional: also block some common “view source/devtools” shortcuts (deterrent only)
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();

      // F12
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }

      // Ctrl/Cmd + U (view source), Ctrl/Cmd + S (save), Ctrl/Cmd + Shift + I/J/C (devtools)
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (ctrlOrCmd && (key === "u" || key === "s")) {
        e.preventDefault();
        return;
      }
      if (ctrlOrCmd && e.shiftKey && (key === "i" || key === "j" || key === "c")) {
        e.preventDefault();
        return;
      }
    };

    document.addEventListener("contextmenu", onContextMenu, { capture: true });
    document.addEventListener("keydown", onKeyDown, { capture: true });

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, { capture: true } as any);
      document.removeEventListener("keydown", onKeyDown, { capture: true } as any);
    };
  }, []);

  return null;
}
