// app/on-demand/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, PlayCircle, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Channel = {
  id: string; // channels.id is TEXT in your DB
  name: string | null;
  logo_url: string | null;
};

export default function OnDemandChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase
          .from("channels")
          .select("id, name, logo_url")
          .order("id", { ascending: true });

        if (error) throw error;
        if (!cancelled) {
          setChannels((data || []) as Channel[]);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("Error loading channels for on-demand", e);
          setErr(e?.message || "Failed to load channels.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function toNumericId(id: string): number {
    const n = Number(id);
    return Number.isFinite(n) ? n : NaN;
  }

  const sortedChannels = [...channels].sort(
    (a, b) => toNumericId(a.id) - toNumericId(b.id)
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-8 space-y-6">

        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Tv2 className="h-7 w-7 text-amber-400" />
              On-Demand Library
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-xl">
              Browse channels and watch programs on-demand, outside of the live schedule.
            </p>
          </div>

          <div className="flex gap-2">
            {/* Back to Member Hub */}
            <Link href="/app">
              <Button
                variant="outline"
                className="border-slate-600 bg-slate-900 text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Member Hub
              </Button>
            </Link>

            {/* Back to Channels */}
            <Link href="/channels">
              <Button
                variant="outline"
                className="border-slate-600 bg-slate-900 text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Channels
              </Button>
            </Link>
          </div>
        </header>

        {/* Error / loading states */}
        {err && (
          <div className="rounded-md border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-200">
            {err}
          </div>
        )}
        {loading && (
          <div className="py-10 text-center text-sm text-slate-300">
            Loading channels…
          </div>
        )}

        {/* Channels Grid */}
        {!loading && !err && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedChannels.map((ch) => {
              const numericId = toNumericId(ch.id);
              const label = ch.name || `Channel ${numericId || ch.id}`;

              return (
                <Link
                  key={ch.id}
                  href={`/on-demand/${ch.id}`}
                  className="group block"
                >
                  <div className="relative flex h-full flex-col rounded-xl border border-slate-700 bg-slate-900/70 p-4 shadow-md transition-transform duration-200 group-hover:-translate-y-1 group-hover:border-amber-400/60">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-sm font-semibold">
                        {Number.isFinite(numericId) ? numericId : ch.id}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative h-10 w-10 rounded-md bg-black/40 overflow-hidden">
                          {ch.logo_url ? (
                            <Image
                              src={ch.logo_url}
                              alt={label}
                              fill
                              sizes="40px"
                              className="object-contain"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                              No Logo
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold line-clamp-1">
                            {label}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Tap to browse on-demand programs
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-slate-400">
                      <span>On-Demand</span>
                      <span className="flex items-center gap-1 text-amber-300 group-hover:text-amber-200">
                        <PlayCircle className="h-3 w-3" />
                        View programs
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}

            {sortedChannels.length === 0 && !loading && !err && (
              <p className="col-span-full py-10 text-center text-sm text-slate-400">
                No channels found.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
