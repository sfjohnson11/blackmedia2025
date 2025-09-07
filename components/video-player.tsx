// components/video-player.tsx
"use client";

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react";

type Props = {
  src: string;
  poster?: string;
  isStandby?: boolean;
  programTitle?: string;
  autoPlay?: boolean;                 // default: true
  muted?: boolean;                    // default: true (safe autoplay)
  playsInline?: boolean;              // default: true (iOS)
  preload?: "auto" | "metadata" | "none";
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
    muted = true,
    playsInline = true,
    preload = "auto",
    onVideoEnded,
    onError,
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(!!muted);
  const [showSoundPrompt, setShowSoundPrompt] = useState<boolean>(!!muted);

  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

  // Keep DOM muted in sync with state
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = isMuted;
    if (!isMuted && v.volume === 0) v.volume = 1.0;
  }, [isMuted]);

  // Try to autoplay. If blocked, force muted and retry.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const tryPlay = async () => {
      try {
        if (autoPlay) {
          // Use a small timeout to ensure attributes are applied
          await new Promise((r) => setTimeout(r, 0));
          await v.play();
          // If we got here and it's muted, keep the prompt visible; if not, hide it.
          setShowSoundPrompt(v.muted);
        }
      } catch (err: any) {
        // Autoplay with sound is blocked on some browsers. Fall back to muted.
        if (!v.muted) {
          v.muted = true;
          setIsMuted(true);
          setShowSoundPrompt(true);
          try {
            await v.play();
          } catch {
            // If still blocked, user will need to press the button overlay.
          }
        }
      }
    };

    tryPlay();
  }, [src, autoPlay]);

  const toggleMute = async () => {
    const v = videoRef.current;
    if (!v) return;
    // Unmute needs a user gesture; this handler is a gesture.
    const next = !isMuted;
    setIsMuted(next);
    setShowSoundPrompt(next); // show prompt only while muted
    try {
      if (!next) {
        // ensure audible
        if (v.volume === 0) v.volume = 1.0;
      }
      // Make sure playback resumes after unmute
      await v.play().catch(() => {});
    } catch {}
  };

  const titleBadge =
    programTitle ? programTitle : isStandby ? "Standby" : "Playing";

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        src={src}
        autoPlay={autoPlay}
        muted={isMuted}
        playsInline={playsInline}
        preload={preload}
        onEnded={() => onVideoEnded?.()}
        onError={(e) => onError?.(e)}
        controls
      />

      {/* Title / Status badge */}
      <div className="absolute left-2 bottom-2 text-xs px-2 py-1 rounded bg-black/60 text-white pointer-events-none">
        {titleBadge}
      </div>

      {/* Mute/Unmute toggle (bottom-right) */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute right-2 bottom-2 text-xs px-2 py-1 rounded bg-black/60 text-white hover:bg-black/70"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? "🔇 Unmute" : "🔊 Mute"}
      </button>

      {/* Big “Tap for sound” prompt (center) when muted */}
      {showSoundPrompt && (
        <button
          type="button"
          onClick={toggleMute}
          className="absolute px-4 py-2 rounded-lg bg-white/90 text-black font-semibold hover:bg-white"
          style={{ backdropFilter: "blur(4px)" }}
        >
          Tap for sound
        </button>
      )}
    </div>
  );
});

export default VideoPlayer;
