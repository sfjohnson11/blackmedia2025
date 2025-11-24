"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type SignupRequest = {
  id: string;
  email: string;
  name: string | null;
  reason: string | null;
  favorite_channel: string | null;
  volunteer_interest: string | null;
  donate_interest: string | null;
  note: string | null;
  created_at: string;
};

export default function SignupRequestsPage() {
  const supabase = createClientComponentClient();
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRequests() {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("signup_requests")
        .select(
          "id, email, name, reason, favorite_channel, volunteer_interest, donate_interest, note, created_at"
        )
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Error loading signup requests:", error);
        setErrorMsg("Could not load signup requests.");
        setLoading(false);
        return;
      }

      setRequests(data || []);
      setLoading(false);
    }

    loadRequests();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-5xl px-4 pt-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Signup Requests
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            People who requested access through the Request Access form.
          </p>
        </header>

        {loading && (
          <p className="text-sm text-slate-300">Loading signup requests…</p>
        )}

        {errorMsg && (
          <div className="mb-4 rounded border border-red-500/60 bg-red-950/40 p-3 text-sm text-red-100">
            {errorMsg}
          </div>
        )}

        {!loading && !errorMsg && requests.length === 0 && (
          <p className="text-sm text-slate-300">No signup requests yet.</p>
        )}

        {!loading && !errorMsg && requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      {req.name || "No name provided"}
                    </div>
                    <div className="text-xs text-slate-300">
                      {req.email}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(req.created_at).toLocaleString()}
                  </div>
                </div>

                {req.reason && (
                  <div className="mt-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Why they want to join
                    </div>
                    <div className="text-slate-100">{req.reason}</div>
                  </div>
                )}

                {req.favorite_channel && (
                  <div className="mt-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Most interested in
                    </div>
                    <div className="text-slate-100">
                      {req.favorite_channel}
                    </div>
                  </div>
                )}

                <div className="mt-2 grid gap-3 text-xs text-slate-200 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Volunteer?
                    </div>
                    <div>{req.volunteer_interest || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Donate?
                    </div>
                    <div>{req.donate_interest || "—"}</div>
                  </div>
                </div>

                {req.note && (
                  <div className="mt-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Extra notes
                    </div>
                    <div className="text-slate-100 whitespace-pre-wrap">
                      {req.note}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
