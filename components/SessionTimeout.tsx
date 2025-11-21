// components/SessionTimeout.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TIMEOUT_MINUTES = 30;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;
const STORAGE_KEY = "bttv-last-activity";

export default function SessionTimeout() {
  const router = useRouter();

  useEffect(() => {
    const markActivity = () => {
      try {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      } catch {
        // ignore
      }
    };

    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (!existing) {
        markActivity();
      }
    } catch {
      // ignore
    }

    const events: (keyof WindowEventMap)[] = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
    ];

    events.forEach((eventName) =>
      window.addEventListener(eventName, markActivity)
    );

    const interval = window.setInterval(async () => {
      try {
        const value = localStorage.getItem(STORAGE_KEY);
        const last = value ? Number(value) : 0;
        const now = Date.now();

        if (!last) return;

        const inactiveFor = now - last;

        if (inactiveFor > TIMEOUT_MS) {
          window.clearInterval(interval);

          try {
            await supabase.auth.signOut();
          } catch {
            // ignore
          }

          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            // ignore
          }

          router.replace("/login");
        }
      } catch {
        // ignore
      }
    }, 60_000); // check every 60 seconds

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, markActivity)
      );
      window.clearInterval(interval);
    };
  }, [router]);

  return null;
}
