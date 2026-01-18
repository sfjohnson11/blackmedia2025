"use client";

import { useEffect } from "react";

export default function DisableContextMenu() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Block common “view source/devtools/save” shortcuts (best-effort)
      if (
        (e.ctrlKey && (key === "s" || key === "u" || key === "p")) || // save, view source, print
        (e.ctrlKey && e.shiftKey && (key === "i" || key === "c" || key === "j")) || // devtools
        key === "f12"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown, { capture: true });

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown, { capture: true } as any);
    };
  }, []);

  return null;
}
