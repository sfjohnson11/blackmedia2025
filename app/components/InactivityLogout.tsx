"use client";

/* ============================================================
   BLACK TRUTH TV — INACTIVITY LOGOUT
   Signs members out after 3 hours without activity, so stale
   "zombie" sessions can't linger and shared computers stay safe.
   Mount once in app/layout.tsx.
   ============================================================ */

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

const TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours
const CHECK_EVERY_MS = 60 * 1000; // check once a minute
const WRITE_THROTTLE_MS = 30 * 1000; // record activity at most every 30s
const STORAGE_KEY = "btv_last_activity";

export default function InactivityLogout() {
  const supabase = createClient();
  const lastWriteRef = useRef(0);

  useEffect(() => {
    // Record activity (throttled so we don't hammer localStorage)
    const markActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < WRITE_THROTTLE_MS) return;
      lastWriteRef.current = now;
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        /* storage unavailable — no-op */
      }
    };

    // Any of these count as "being active"
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((ev) =>
      window.addEventListener(ev, markActivity, { passive: true })
    );

    // Start the clock now if none exists
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      }
    } catch {
      /* no-op */
    }

    const checkIdle = async () => {
      let last = Date.now();
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) last = parseInt(stored, 10) || Date.now();
      } catch {
        return;
      }

      if (Date.now() - last < TIMEOUT_MS) return;

      // Idle past the limit — only act if there IS a session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* no-op */
      }
      await supabase.auth.signOut();
      // Full reload to /login clears any in-memory state everywhere
      window.location.href = "/login?reason=timeout";
    };

    // Check once a minute, and immediately when a hidden tab comes back
    const interval = setInterval(checkIdle, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkIdle();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Run one check on mount (catches tabs reopened after a long time)
    checkIdle();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, markActivity));
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [supabase]);

  return null;
}
