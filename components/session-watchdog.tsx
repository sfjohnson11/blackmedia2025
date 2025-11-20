// components/session-watchdog.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

export default function SessionWatchdog() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let lastActivity = Date.now();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // We treat these as "user is here" signals
    const activityEvents: (keyof WindowEventMap)[] = [
      "click",
      "keydown",
      "mousemove",
      "touchstart",
      "focus",
      "visibilitychange",
    ];

    const resetTimer = () => {
      // If the tab is hidden, we don't count that as "active"
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      lastActivity = Date.now();
    };

    const checkIdle = async () => {
      const now = Date.now();
      const idleFor = now - lastActivity;

      if (idleFor >= IDLE_LIMIT_MS) {
        // 🔐 Too long idle → sign out and force login again
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.error("Error during signOut:", e);
        }

        // Preserve where they were, so you can send them back there after login
        const currentPath =
          pathname +
          (searchParams && searchParams.toString()
            ? `?${searchParams.toString()}`
            : "");

        router.push(
          `/login?reason=timeout&redirect=${encodeURIComponent(currentPath)}`
        );
        return;
      }

      // Schedule the next check
      timeoutId = setTimeout(checkIdle, 60 * 1000); // check every 60 seconds
    };

    // Start listening for activity
    activityEvents.forEach((event) =>
      window.addEventListener(event, resetTimer)
    );

    // Kick off the first idle check
    timeoutId = setTimeout(checkIdle, 60 * 1000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
    };
  }, [router, pathname, searchParams, supabase]);

  return null;
}
