// app/freedom-school/FreedomSchoolClient.tsx
"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, AlertCircle, CheckCircle, Info, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Build a public URL for a Storage object when a plain relative path is provided */
function getFullUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/g, "");
  const clean = (path || "").replace(/^\/+/g, "");
  return `${base}/storage/v1/object/public/${clean}`;
}

function isAbsoluteUrl(s: string | null | undefined) {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/* ---------------- Types ---------------- */
type FSVideoRow = { mp4_url: string | null; poster_url: string | null; published: boolean | null };
type ChannelRow = { id: string | number; name?: string | null; logo_url?: string | null };

const FEATURED_IDS = [1, 4, 8, 18, 30]; // include CH 30 as Freedom School home
const HEADER_IMG = getFullUrl("freedom-school/freedom-schoolimage.jpeg");

export default function FreedomSchoolClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [featured, setFeatured] = useState<ChannelRow[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  /* ---------- Load latest Freedom School video ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("freedom_school_videos")
        .select("mp4_url, poster_url, published")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<FSVideoRow>();

      if (!alive) return;

      if (error || !data || typeof data.mp4_url !== "string" || !data.mp4_url.trim()) {
        console.error("Freedom School fetch error:", error, data);
        setError("No Freedom School video available at the moment.");
        setIsLoading(false);
        return;
      }

      const src = isAbsoluteUrl(data.mp4_url) ? data.mp4_url : getFullUrl(data.mp4_url);
      const poster =
        data.poster_url && typeof data.poster_url === "string"
          ? (isAbsoluteUrl(data.poster_url) ? data.poster_url : getFullUrl(data.poster_url))
          : null;

      setVideoUrl(src);
      setPosterUrl(poster);
      setIsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* ---------- Load featured channels (1,4,8,18,30) ---------- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingFeatured(true);
      const wantedAsText = FEATURED_IDS.map(String); // channels.id is TEXT in your DB
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, logo_url")
        .in("id", wantedAsText);

      if (cancel) return;

      if (error) {
        console.warn("Featured channels error:", error);
        setFeatured([]);
      } else {
        const rows = (data || []) as ChannelRow[];
        rows.sort((a, b) => Number(a.id) - Number(b.id)); // keep 1,4,8,18,30 order
        setFeatured(rows);
      }
      setLoadingFeatured(false);
    })();

    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="bg-black min-h-screen text-white">
      {/* Brand header band */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_450px_at_15%_-10%,rgba(168,85,247,0.22),transparent_60%),radial-gradient(700px_350px_at_85%_-10%,rgba(234,179,8,0.18),transparent_60%)]" />
        <div className="relative px-4 md:px-6 py-4 border-b border-white/10 bg-gradient-to-b from-[#2a0f3c] via-[#160a26] to-[#000]">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-300 hover:text-white hover:underline flex items-center"
              aria-label="Back to Home"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
            </button>
            <div className="text-xs text-white/70">Freedom School</div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header image + title */}
        <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden shadow-[0_0_80px_-30px_rgba(250,204,21,.45)] mb-6 ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HEADER_IMG}
            alt="Freedom School Header"
            className="w-full h-full object-cover"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 p-4 md:p-6">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#facc15] via-[#fde68a] to-white">
                📚 Freedom School
              </span>
            </h1>
            <p className="text-gray-200">Our virtual classroom is always open.</p>
          </div>
        </div>

        {/* Video player card */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-xl mb-8 ring-1 ring-white/10 bg-zinc-950/60">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-300 text-sm">
              Preparing stream…
            </div>
          ) : videoUrl ? (
            <video
              ref={videoRef}
              key={videoUrl}
              src={videoUrl}
              poster={posterUrl ?? undefined}
              controls
              autoPlay
              playsInline
              className="w-full h-full"
              onError={() => setError("Video failed to load.")}
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-800 text-gray-300">
              <p>{error || "Video content coming soon."}</p>
            </div>
          )}
        </div>

        {error && !videoUrl && (
          <div className="text-yellow-500 flex items-center gap-2 mb-6 p-3 bg-yellow-950 rounded-md">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}

        {/* Featured Channels */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl md:text-2xl font-bold">Featured Channels</h2>
            <Link
              href="/guide"
              className="text-sm text-[#facc15] hover:underline inline-flex items-center gap-1"
            >
              Open Guide <Play size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {loadingFeatured && (
              <div className="col-span-full text-sm text-gray-400">Loading channels…</div>
            )}
            {!loadingFeatured &&
              [1, 4, 8, 18, 30].map((id) => {
                const ch = featured.find((c) => Number(c.id) === id);
                const name = ch?.name || `Channel ${id}`;
                const logo = ch?.logo_url || "";
                return (
                  <Link
                    key={id}
                    href={`/watch/${id}`}
                    className="group rounded-xl ring-1 ring-white/10 bg-zinc-950/60 hover:bg-zinc-900/60 transition overflow-hidden"
                  >
                    <div className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-sm font-semibold">
                        {id}
                      </div>
                      <div className="min-w-0">
                        <div className="relative w-24 h-10 rounded bg-black/40 overflow-hidden ring-1 ring-white/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {logo ? (
                            <img src={logo} alt={`${name} logo`} className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">
                              No logo
                            </div>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-300 truncate">{name}</div>
                      </div>
                    </div>
                    <div className="px-3 pb-3">
                      <div className="text-[11px] text-gray-500 group-hover:text-gray-300">
                        Watch now →
                      </div>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>

        {/* Signup */}
        <FreedomSchoolSignup />
      </div>
    </div>
  );
}

/* ---------- Signup ---------- */
function FreedomSchoolSignup() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<null | "success" | "error" | "info">(null);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    setMessage("");

    const n = name.trim();
    const em = email.trim();
    if (!n || !em) {
      setStatus("error");
      setMessage("Name and email are required.");
      setIsSubmitting(false);
      return;
    }

    // Check if exists
    const { data: existing, error: selErr } = await supabase
      .from("freedom_school_signups")
      .select("id")
      .eq("email", em)
      .maybeSingle();

    if (selErr) {
      console.error("Signup check error:", selErr);
      setStatus("error");
      setMessage("Could not verify email. Please try again.");
      setIsSubmitting(false);
      return;
    }

    if (existing) {
      setStatus("info");
      setMessage("This email address has already been signed up. Thank you!");
      setIsSubmitting(false);
      return;
    }

    // Insert
    const { error: insErr } = await supabase
      .from("freedom_school_signups")
      .insert([{ name: n, email: em }]);

    if (insErr) {
      console.error("Signup insert error:", insErr);
      setStatus("error");
      setMessage((insErr as any).code === "23505" ? "This email is already signed up." : "Failed to sign up.");
    } else {
      setStatus("success");
      setMessage("Thank you for signing up! We'll keep you updated.");
      setName("");
      setEmail("");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-gray-800 rounded-lg shadow-md ring-1 ring-white/10">
      <h2 className="text-xl font-semibold text-white mb-4 text-center">Join Freedom School Updates</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name-signup" className="text-gray-300">Full Name</Label>
          <Input
            id="name-signup"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-red-500 focus:border-red-500"
            placeholder="Enter your full name"
          />
        </div>
        <div>
          <Label htmlFor="email-signup" className="text-gray-300">Email Address</Label>
          <Input
            id="email-signup"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-red-500 focus:border-red-500"
            placeholder="Enter your email address"
          />
        </div>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 disabled:opacity-70"
        >
          {isSubmitting ? "Submitting..." : "Sign Up for Updates"}
        </Button>

        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-md text-sm ${
              status === "success"
                ? "bg-green-900 text-green-300"
                : status === "error"
                  ? "bg-red-900 text-red-300"
                  : status === "info"
                    ? "bg-blue-900 text-blue-300"
                    : ""
            }`}
          >
            {status === "success" && <CheckCircle size={18} />}
            {status === "error" && <AlertCircle size={18} />}
            {status === "info" && <Info size={18} />}
            <span>{message}</span>
          </div>
        )}
      </form>
    </div>
  );
}
