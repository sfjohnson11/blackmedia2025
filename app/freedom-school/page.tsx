// app/freedom-school/page.tsx
"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, AlertCircle, CheckCircle, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Build a public URL for a Storage object when a plain relative path is provided */
function getFullUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/g, "");
  const clean = path.replace(/^\/+/g, "");
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

export default function FreedomSchoolPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headerImageUrl = getFullUrl("freedom-school/freedom-schoolimage.jpeg");

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
        .maybeSingle();

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
          ? isAbsoluteUrl(data.poster_url)
            ? data.poster_url
            : getFullUrl(data.poster_url)
          : null;

      setVideoUrl(src);
      setPosterUrl(poster);
      setIsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="bg-black min-h-screen text-white p-4 md:p-6">
      <button
        onClick={() => router.push("/")}
        className="mb-4 text-sm text-gray-300 hover:text-white hover:underline flex items-center"
        aria-label="Back to Home"
      >
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
      </button>

      {/* Header image */}
      <div className="mb-6">
        <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-4 shadow-lg">
          <img
            src={headerImageUrl}
            alt="Freedom School Header"
            className="w-full h-full object-cover"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 p-4 md:p-6">
            <h1 className="text-3xl md:text-4xl font-bold">📚 Freedom School</h1>
            <p className="text-gray-200">Our virtual classroom is always open.</p>
          </div>
        </div>
      </div>

      {/* Video */}
      <div className="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-xl mb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400">Loading video...</div>
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
          <div className="flex items-center justify-center h-full bg-gray-800 text-gray-400 rounded-lg">
            <p>{error || "Video content coming soon."}</p>
          </div>
        )}
      </div>

      {error && !videoUrl && (
        <div className="text-yellow-500 flex items-center gap-2 mb-4 p-3 bg-yellow-950 rounded-md">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      <FreedomSchoolSignup />
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
    <div className="max-w-md mx-auto mt-8 p-6 bg-gray-800 rounded-lg shadow-md">
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
