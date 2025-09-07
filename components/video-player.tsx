// components/video-player.tsx
"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string;
  isStandby?: boolean;
  programTitle?: string;
  autoPlay?: boolean;
  muted?: boolean; // default -> false (we want sound)
  playsInline?: boolean;
  preload?: "auto" | "metadata" | "none";
  loop?: boolean; // standby can pass true
  onVideoEnded?: () => void;
  onError?: (e?: any) => void;
};

const VideoPlayer = forwardRef<HTMLVideoElement, Props>(function VideoPlayer(
  {
    src,
    poster,
    isStandby = false,
    programTitle,
    autoPlay = true,
    muted = false,               // ← SOUND ON BY DEFAULT
    playsInline = true,
    preload = "auto",
    loop = false,
    onVideoEnded,
    onError,
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(muted);
  const [needUserGesture, setNeedUserGesture] = useState<boolean>(false);

  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

  // Try to autoplay; if blocked, show overlay and wait for click
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const tryPlay = async () => {
      try {
        // ensure desired mute state before play attempt
        el.muted = isMuted;
        el.volume = isMuted ? 0 : 1;
        if (autoPlay) {
          const p = el.play();
          if (p && typeof p.then === "function") await p;
        }
        setNeedUserGesture(false);
      } catch {
        // Autoplay with sound likely blocked → require a user tap
        setNeedUserGesture(true);
      }
    };

    // load + attempt
    if (el.src !== src) el.src = src;
    tryPlay();

    // re-run when src or mute state changes
  }, [src, isMuted, autoPlay]);

  const handleUserStart = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      el.muted = false; // user gesture allows sound
      el.volume = 1;
      await el.play();
      setIsMuted(false);
      setNeedUserGesture(false);
    } catch (e) {
      // If something still fails, keep the overlay
      console.warn("User-start play failed:", e);
      setNeedUserGesture(true);
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    const next = !isMuted;
    el.muted = next;
    el.volume = next ? 0 : 1;
    setIsMuted(next);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        // src is set in effect to ensure reloads are honored
        playsInline={playsInline}
        preload={preload}
        autoPlay={autoPlay}
        muted={isMuted}
        loop={loop || isStandby}
        controls
        onEnded={() => onVideoEnded?.()}
        onError={(e) => onError?.(e)}
      />

      {/* Bottom-left label */}
      <div className="absolute left-2 bottom-2 text-xs px-2 py-1 rounded bg-black/60 text-white pointer-events-none select-none">
        {isStandby ? "Standby" : programTitle || "Playing"}
      </div>

      {/* Mute toggle (bottom-right) */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute right-2 bottom-2 text-xs px-2 py-1 rounded bg-black/70 text-white hover:bg-black/80"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? "🔇 Unmute" : "🔊 Mute"}
      </button>

      {/* Tap-to-play overlay when autoplay-with-sound is blocked */}
      {needUserGesture && (
        <button
          type="button"
          onClick={handleUserStart}
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm sm:text-base font-medium"
        >
          ▶ Tap to play with sound
        </button>
      )}
    </div>
  );
});

export default VideoPlayer;
