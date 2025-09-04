// components/video-player.tsx
// Minimal, robust MP4 player with overlay + simple recovery and a debug URL link.

"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string;
  isStandby?: boolean;
  programTitle?: string;
  onVideoEnded?: () => void;
  isPrimaryLiveStream?: boolean;        // ignored (you only play MP4s + CH21 YouTube handled elsewhere)
  onPrimaryLiveStreamError?: () => void; // ignored here
  showNoLiveNotice?: boolean;            // ignored
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  preload?: "auto" | "metadata" | "none";
};

const CANPLAY_TIMEOUT_MS = 8000;
const STABLE_PLAY_MS = 600;
const MAX_RETRIES = 1;

export default function VideoPlayer({
  src,
  poster,
  isStandby = false,
  programTitle,
  onVideoEnded,
  autoPlay = true,
  muted = true,
  playsInline = true,
  preload = "auto",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [overlay, setOverlay] = useState<{show: boolean; text: string}>({show: true, text: "Starting stream…"});
  const [tries, setTries] = useState(0);

  const canplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (canplayTimer.current) clearTimeout(canplayTimer.current);
    if (stableTimer.current)  clearTimeout(stableTimer.current);
  };

  const attach = () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.pause();
      v.removeAttribute("src");
      while (v.firstChild) v.removeChild(v.firstChild);
      v.load();
    } catch {}

    v.crossOrigin = "anonymous";
    v.preload = preload;
    v.muted = muted;
    v.playsInline = playsInline;

    // Use a <source> with type=video/mp4 to help some browsers
    const s = document.createElement("source");
    s.src = src;
    s.type = "video/mp4";
    v.appendChild(s);

    setOverlay({show: true, text: "Starting stream…"});
    setTimeout(() => {
      try { v.currentTime = 0; v.load(); } catch {}
      v.play().catch(() => {});
    }, 0);

    canplayTimer.current = setTimeout(() => {
      // Didn’t reach canplay in time: retry or fail
      if (tries < MAX_RETRIES) {
        setTries(t => t + 1);
        setOverlay({show: true, text: "Recovering stream…" });
        attach();
      } else {
        setOverlay({show: true, text: isStandby ? "Video unavailable" : "A video playback error occurred."});
      }
    }, CANPLAY_TIMEOUT_MS);
  };

  useEffect(() => {
    setTries(0);
    clearTimers();
    attach();
    return () => {
      clearTimers();
      const v = videoRef.current;
      if (v) {
        try { v.pause(); v.removeAttribute("src"); v.load(); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div className="relative w-full h-full bg-black">
      {overlay.show && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={programTitle || "Channel"}
              className="max-h-[60%] max-w-[80%] object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : null}
          <div className="mt-4 flex items-center gap-2 text-gray-300">
            {!/unavailable|error/i.test(overlay.text) && <Loader2 className="h-5 w-5 animate-spin" />}
            <span>{overlay.text}</span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500 break-all px-3 text-center">
            <a href={src} target="_blank" rel="noreferrer" className="underline opacity-80 hover:opacity-100">
              Open video URL
            </a>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay={autoPlay}
        muted={muted}
        playsInline={playsInline}
        preload={preload}
        controls={false}
        poster={poster}
        className="w-full h-full"
        onCanPlay={() => {
          if (canplayTimer.current) clearTimeout(canplayTimer.current);
        }}
        onPlaying={() => {
          if (stableTimer.current) clearTimeout(stableTimer.current);
          stableTimer.current = setTimeout(() => setOverlay({show:false, text:""}), STABLE_PLAY_MS);
        }}
        onEnded={() => onVideoEnded?.()}
        onError={() => {
          setOverlay({show: true, text: isStandby ? "Video unavailable" : "A video playback error occurred."});
        }}
      />
    </div>
  );
}
