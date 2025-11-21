"use client";

import { useEffect, useState } from "react";

// We’re not using router or Supabase in this emergency version.
// Once you’re back in and calm, we can re-enable them safely.

export default function AdminPage() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // 🚨 EMERGENCY OVERRIDE: ALWAYS ALLOW ACCESS
    // This bypasses ALL auth checks so you can actually get to your tools.
    setAllowed(true);
  }, []);

  if (!allowed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "black",
          color: "white",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <>
      {/* ✅ PASTE YOUR EXISTING ADMIN UI HERE. 
          Whatever you had before (cards, tools, scheduler, etc.)
          goes inside this fragment. */}
      {/* Example:
        <main>
          ... your admin dashboard JSX ...
        </main>
      */}
    </>
  );
}
