// components/video-player.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string;
  programTitle?: string;
  isStandby?: boolean;
  autoPlay?: boolean;      // default true
  muted?: boolean;         // default false
  playsInline?: boolean;   // default true
  preload?: "auto" | "metadata" | "none"; // default "auto"
  onVideoEnded?: () => void;
  onError?: () => void;
};

export default function VideoPlayer({
  src,
  poster,
  programTitle,
  isStandby = false,
  autoPlay = true,            // enable autoplay by default
  muted: mutedProp = false,
  playsInline = true,
  preload = "auto",           // ← default to "auto" for faster start
  onVideoEnded,
  onError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Keep a React state mirror of "muted" for the JSX attribute
  const [muted, setMuted] = useState<boolean>(!!mutedProp);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // If parent flips the muted prop, reflect it here too
  useEffect(() => {
    setMuted(!!mutedProp);
    const v = videoRef.current;
    if (v) v.muted = !!mutedProp;
  }, [mutedProp]);

  const tryPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !autoPlay) return;

    // Ensure inline & preload are set as attributes/properties
    v.playsInline = !!playsInline;
    v.preload = preload || "auto";

    // First attempt: respect incoming muted prop
    try {
      v.muted = !!mutedProp;
      await v.play();
      setAutoplayBlocked(false);
      return;
    } catch {
      // Fallback: force muted autoplay (required by most browsers)
    }

    try {
      v.muted = true;
      await v.play();
      setMuted(true);
      setAutoplayBlocked(true); // show "Tap to unmute"
    } catch {
      // Still blocked — user can press play
      setAutoplayBlocked(true);
    }
  }, [autoPlay, mutedProp, playsInline, preload]);

  // When src changes, force a clean reload and attempt autoplay
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setAutoplayBlocked(false);

    // Force the element to re-evaluate the new src
    // (key={src} below also guarantees a remount, but this helps if React reuses)
    try {
      v.pause();
      v.load();
    } catch {}

    void tryPlay();
  }, [src, tryPlay]);

  // Some browsers only allow play after metadata/canplay
  const handleLoadedMetadata = useCallback(() => {
    void tryPlay();
  }, [tryPlay]);

  const handleCanPlay = useCallback(() => {
    // As soon as we can play, try again (covers iOS Safari)
    void tryPlay();
  }, [tryPlay]);

  const handleUnmute = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = false;
      setMuted(false);
      setAutoplayBlocked(false);
      v.volume = 1;
      await v.play().catch(() => {});
    } catch {}
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video
        key={src}                   // ← remount on source change
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        muted={muted}
        playsInline={playsInline}
        preload={preload}
        className="w-full h-full object-contain bg-black"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onEnded={onVideoEnded}
        onError={onError}
      />

      {autoplayBlocked && muted && (
        <button
          onClick={handleUnmute}
          className="absolute bottom-3 right-3 rounded-full bg-white/90 text-black text-xs font-semibold px-3 py-2 shadow"
        >
          Tap to unmute
        </button>
      )}

      {isStandby && (
        <div className="absolute top-3 left-3 text-[10px] uppercase tracking-wide bg-yellow-400 text-black px-2 py-1 rounded">
          Standby
        </div>
      )}

      {programTitle && (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[70%] truncate text-white/90 text-sm drop-shadow">
          {programTitle}
        </div>
      )}
    </div>
  );
}
