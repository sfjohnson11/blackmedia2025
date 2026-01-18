"use client";

import { useEffect } from "react";

export default function DisableContextMenu() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (e.key === "F12") e.preventDefault();
      if (ctrlOrCmd && (key === "u" || key === "s")) e.preventDefault();
      if (ctrlOrCmd && e.shiftKey && (key === "i" || key === "j" || key === "c"))
        e.preventDefault();
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
