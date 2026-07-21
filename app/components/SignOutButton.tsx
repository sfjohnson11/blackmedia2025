"use client";

/* ============================================================
   BLACK TRUTH TV — SIGN OUT BUTTON
   Drop-in button that signs the member out and returns them
   to the login page. Usable anywhere:
     import SignOutButton from "@/app/components/SignOutButton";
     <SignOutButton />
   ============================================================ */

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function SignOutButton({
  className,
}: {
  className?: string;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      try {
        localStorage.removeItem("btv_last_activity");
      } catch {
        /* no-op */
      }
      await supabase.auth.signOut();
    } finally {
      // Full reload clears all in-memory state everywhere
      window.location.href = "/login";
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={busy}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-slate-600/70 bg-slate-800/70 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-red-900/40 hover:border-red-400/50 hover:text-red-200 transition disabled:opacity-60"
      }
      title="Sign out of Black Truth TV"
    >
      {busy ? "Signing out…" : "⏻ Sign Out"}
    </button>
  );
}
