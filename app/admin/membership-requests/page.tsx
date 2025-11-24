// app/admin/membership-requests/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type SignupRequest = {
  id: string;
  created_at: string | null;
  name: string | null;
  email: string | null;
  reason: string | null;
  favorite_channel: string | null;
  volunteer_interest: string | null;
  donate_interest: string | null;
  note: string | null;
};

export default function MembershipRequestsPage() {
  const supabase = createClientComponentClient();

  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("signup_requests")
        .select(
          "id, created_at, name, email, reason, favorite_channel, volunteer_interest, donate_interest, note"
        )
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Error loading signup_requests:", error);
        setErrorMsg(error.message);
      } else {
        setRequests(data || []);
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const hasRequests = requests.length > 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold md:text-xl">
              Membership / Sign-up Requests
            </h1>
            <p className="text-xs text-slate-300 md:text-sm">
              Incoming requests from{" "}
              <span className="font-mono text-amber-300">
                /request-access
              </span>
              .
            </p>
          </div>

          <Link href="/admin" className="text-xs md:text-sm">
            <button className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-amber-400 hover:text-amber-200">
              ⬅ Back to Admin
            </button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {/* Status / summary */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
          {loading && <p>Loading requests…</p>}

          {!loading && errorMsg && (
            <p className="text-red-400">
              Error loading requests: {errorMsg}
            </p>
          )}

          {!loading && !errorMsg && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-200">
                Total requests:{" "}
                <span className="font-semibold text-amber-300">
                  {requests.length}
                </span>
              </span>
              {hasRequests && (
                <span className="text-xs text-slate-400">
                  Most recent at{" "}
                  {requests[0].created_at
                    ? new Date(requests[0].created_at).toLocaleString(
                        "en-US",
                        {
                          month: "short",
                          day: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )
                    : "—"}
                </span>
              )}
            </div>
          )}
        </section>

        {/* List of requests */}
        {!loading && !errorMsg && !hasRequests && (
          <p className="text-sm text-slate-400">
            No signup requests yet. When someone submits the Request Access
            form, they will appear here.
          </p>
        )}

        {!loading && !errorMsg && hasRequests && (
          <div className="space-y-3">
            {requests.map((req) => {
              const created = req.created_at
                ? new Date(req.created_at)
                : null;

              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-100"
                >
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-semibold">
                        {req.name || "No name given"}
                      </div>
                      <div className="text-xs text-slate-300">
                        {req.email ? (
                          <a
                            href={`mailto:${req.email}`}
                            className="text-amber-300 hover:underline"
                          >
                            {req.email}
                          </a>
                        ) : (
                          "No email"
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      {created
                        ? created.toLocaleString("en-US", {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </div>
                  </div>

                  {/* Reason */}
                  {req.reason && (
                    <div className="mb-2">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Why they want to join
                      </div>
                      <p className="text-sm text-slate-100 whitespace-pre-line">
                        {req.reason}
                      </p>
                    </div>
                  )}

                  {/* Favorite channel */}
                  {req.favorite_channel && (
                    <div className="mb-2">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Favorite channel / interest
                      </div>
                      <p className="text-sm text-slate-100">
                        {req.favorite_channel}
                      </p>
                    </div>
                  )}

                  {/* Volunteer / donate badges */}
                  <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-emerald-900/60 px-3 py-1 text-emerald-200 border border-emerald-500/60">
                      Volunteer:{" "}
                      <span className="font-semibold">
                        {req.volunteer_interest || "—"}
                      </span>
                    </span>
                    <span className="rounded-full bg-amber-900/60 px-3 py-1 text-amber-100 border border-amber-500/60">
                      Donate:{" "}
                      <span className="font-semibold">
                        {req.donate_interest || "—"}
                      </span>
                    </span>
                  </div>

                  {/* Extra notes */}
                  {req.note && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Extra notes
                      </div>
                      <p className="text-sm text-slate-100 whitespace-pre-line">
                        {req.note}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
