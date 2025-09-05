// components/video-player.tsx
"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type Props = {
  src: string;
  poster?: string;
  isStandby?: boolean;
  programTitle?: string;
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  preload?: "auto" | "metadata" | "none";
  onVideoEnded?: () => void;
  onError?: (e?: any) => void;
};

function isHls(url: string) {
  return /\.m3u8(\?|#|$)/i.test(url);
}

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
  const [ready, setReady] = useState(false);
  const hlsRef = useRef<any>(null); // hls.js instance if used

  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

  // Attach source whenever src changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setReady(false);

    // Clean up old hls instance (if any)
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    // If HLS URL and browser doesn't support native HLS, try hls.js (optional)
    if (isHls(src)) {
      const canNativeHls =
        (video as any).canPlayType?.("application/vnd.apple.mpegURL") ||
        (video as any).canPlayType?.("application/x-mpegURL");

      if (canNativeHls) {
        video.src = src;
      } else {
        // If you install hls.js, this will attach automatically.
        // npm i hls.js  (or add it to your bundle)
        // We try dynamic import; if it fails, fall back to direct src.
        (async () => {
          try {
            const mod = await import("hls.js"); // make sure hls.js is installed to use this path
            const Hls = mod.default || (mod as any);
            if (Hls && Hls.isSupported()) {
              const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 60,
              });
              hlsRef.current = hls;
              hls.attachMedia(video);
              hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(src);
              });
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setReady(true);
                if (autoPlay) void safePlay(video);
              });
              hls.on(Hls.Events.ERROR, (_, data: any) => {
                if (data?.fatal) {
                  try {
                    hls.destroy();
                  } catch {}
                  hlsRef.current = null;
                  // Fallback: set src directly (may or may not work in this browser)
                  video.src = src;
                  video.load();
                  if (autoPlay) void safePlay(video);
                }
              });
              return;
            } else {
              // Not supported by hls.js, fall through to native
              video.src = src;
            }
          } catch {
            // hls.js not installed or failed to import; fall back
            video.src = src;
          }
          video.load();
          if (autoPlay) void safePlay(video);
          setReady(true);
        })();
        return () => {
          // cleanup handled above when src changes
        };
      }
    } else {
      // MP4 or other directly playable type
      video.src = src;
    }

    video.load();
    if (autoPlay) void safePlay(video);
    setReady(true);

    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay]);

  // Basic visibility-based pause/resume (optional safeguard)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        try {
          video.pause();
        } catch {}
      } else if (autoPlay) {
        void safePlay(video);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [autoPlay]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        // Controlled via props
        muted={muted}
        playsInline={playsInline}
        preload={preload}
        // Events
        onEnded={() => onVideoEnded?.()}
        onError={(e) => onError?.(e)}
        controls
      />
      {/* Small label overlay (optional) */}
      <div className="absolute left-2 bottom-2 text-xs px-2 py-1 rounded bg-black/60 text-white pointer-events-none">
        {isStandby ? "Standby" : programTitle || (ready ? "Playing" : "Loading…")}
      </div>
    </div>
  );
});

export default VideoPlayer;

// ---- helpers ----
async function safePlay(video: HTMLVideoElement) {
  try {
    // Many browsers require muted to allow autoplay
    if (!video.muted) video.muted = true;
    await video.play();
  } catch {
    // Autoplay might be blocked; user can press play
  }
}
