// components/video-player.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string;
  programTitle?: string;
  isStandby?: boolean;
  autoPlay?: boolean;      // default: false
  muted?: boolean;         // default: false
  playsInline?: boolean;   // default: true
  preload?: "auto" | "metadata" | "none"; // default: "metadata"
  onVideoEnded?: () => void;
  onError?: () => void;
};

export default function VideoPlayer({
  src,
  poster,
  programTitle,
  isStandby = false,
  autoPlay = false,
  muted: mutedProp = false,
  playsInline = true,
  preload = "metadata",
  onVideoEnded,
  onError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState<boolean>(!!mutedProp);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [ready, setReady] = useState(false);

  // Try autoplay (with sound first if requested). If blocked, retry muted.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.muted = !!mutedProp;
    v.playsInline = playsInline;
    v.preload = preload || "metadata";

    const tryPlay = async () => {
      if (!autoPlay) return; // let user click play; keeps sound intact
      try {
        v.muted = !!mutedProp; // try user's preference first
        await v.play();
        setAutoplayBlocked(false);
      } catch (_) {
        if (!mutedProp) {
          // retry muted for policy-compliant autoplay
          try {
            v.muted = true;
            await v.play();
            setMuted(true);
            setAutoplayBlocked(true); // show "Tap to unmute"
          } catch {
            // give up; user will press play
          }
        }
      }
    };

    // kick attempt when src changes
    setReady(false);
    const onCanPlay = () => setReady(true);

    v.addEventListener("canplay", onCanPlay, { once: true });
    void tryPlay();

    return () => {
      v.removeEventListener("canplay", onCanPlay);
      // do not pause here; let React control via key/prop changes
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, autoPlay, mutedProp, playsInline, preload]);

  const handleUnmute = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = false;
      setMuted(false);
      setAutoplayBlocked(false);
      v.volume = 1;
      await v.play().catch(() => {});
    } catch {
      // ignore
    }
  };

  const handleError = () => {
    onError?.();
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        // honor current mute state (can change after fallback)
        muted={muted}
        // keep sound available when user hits play
        playsInline={playsInline}
        preload={preload}
        className="w-full h-full object-contain bg-black"
        onEnded={onVideoEnded}
        onError={handleError}
      />

      {/* “Tap to unmute” chip when policy forced us to start muted */}
      {autoplayBlocked && muted && (
        <button
          onClick={handleUnmute}
          className="absolute bottom-3 right-3 rounded-full bg-white/90 text-black text-xs font-semibold px-3 py-2 shadow"
        >
          Tap to unmute
        </button>
      )}

      {/* Optional tiny label for standby */}
      {isStandby && (
        <div className="absolute top-3 left-3 text-[10px] uppercase tracking-wide bg-yellow-400 text-black px-2 py-1 rounded">
          Standby
        </div>
      )}

      {/* Optional program title */}
      {programTitle && (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[70%] truncate text-white/90 text-sm drop-shadow">
          {programTitle}
        </div>
      )}
    </div>
  );
}
