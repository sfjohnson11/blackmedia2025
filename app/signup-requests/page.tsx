// File: app/admin/signup-requests/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

/*  
   This matches your table:
   signup_request
   --------------------------------------------
   id (uuid)
   name (text)
   email (text)
   reason (text)
   favorite_channel (text)
   volunteer_interest (text)
   donate_interest (text)
   status (text)
   created_at (timestamptz)
*/

type SignupRequest = {
  id: string;
  name: string | null;
  email: string | null;
  reason: string | null;
  favorite_channel: string | null;
  volunteer_interest: string | null;
  donate_interest: string | null;
  status: string | null;
  created_at: string | null;
};

const STATUS_OPTIONS = ["pending", "approved", "denied"] as const;

export default function SignupRequestsPage() {
  const supabase = createClientComponentClient();

  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const { data, error } = await supabase
      .from("signup_request")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading signup_request:", error);
      setErrorMsg(error.message);
    } else {
      setRequests((data || []) as SignupRequest[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function updateStatus(id: string, newStatus: string) {
    setSavingId(id);
    setErrorMsg(null);
    setInfoMsg(null);

    const { error } = await supabase
      .from("signup_request")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      console.error("Error updating status:", error);
      setErrorMsg(error.message);
    } else {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: newStatus } : r
        )
      );
      setInfoMsg("Status updated.");
    }

    setSavingId(null);
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Signup Requests</h1>
          <p className="text-sm text-slate-300">
            Review new user signup requests for Black Truth TV.
          </p>
        </div>

        <Link href="/admin">
          <button className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 hover:border-amber-400 transition">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </button>
        </Link>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="mb-4 rounded border border-red-500 bg-red-900/40 px-3 py-2 text-sm text-red-100">
          {errorMsg}
        </div>
      )}
      {infoMsg && (
        <div className="mb-4 rounded border border-emerald-500 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-100">
          {infoMsg}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-300">
          <Loader2 className="h-6 w-6 animate-spin mb-3" />
          <span className="text-sm">Loading signup requests…</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-6 text-sm text-slate-300">
          No signup requests yet.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                {/* Left */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {req.name || "(No name provided)"}
                    </span>

                    {req.email && (
                      <a
                        href={`mailto:${req.email}`}
                        className="inline-flex items-center text-xs text-amber-300 hover:text-amber-200"
                      >
                        <Mail className="mr-1 h-3 w-3" />
                        {req.email}
                      </a>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Requested:{" "}
                    {req.created_at
                      ? new Date(req.created_at).toLocaleString()
                      : "—"}
                  </div>

                  <div className="mt-2 text-xs text-slate-300">
                    <div className="font-semibold text-slate-100">
                      Why they want to join:
                    </div>
                    <div className="whitespace-pre-line">
                      {req.reason || "—"}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-3">
                    <div>
                      <div className="font-semibold text-slate-100">
                        Favorite channel:
                      </div>
                      <div>{req.favorite_channel || "—"}</div>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-100">
                        Volunteer interest:
                      </div>
                      <div>{req.volunteer_interest || "—"}</div>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-100">
                        Donate interest:
                      </div>
                      <div>{req.donate_interest || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Right */}
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </div>

                  <select
                    value={(req.status || "pending").toLowerCase()}
                    onChange={(e) => updateStatus(req.id, e.target.value)}
                    disabled={savingId === req.id}
                    className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </option>
                    ))}
                  </select>

                  {savingId === req.id && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-300">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving…
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
