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
  const hlsRef = useRef<any>(null);

  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setReady(false);

    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }

    if (isHls(src)) {
      const canNativeHls =
        (video as any).canPlayType?.("application/vnd.apple.mpegURL") ||
        (video as any).canPlayType?.("application/x-mpegURL");

      if (canNativeHls) {
        video.src = src;
        video.load();
        if (autoPlay) void safePlay(video);
        setReady(true);
      } else {
        (async () => {
          try {
            const mod = await import("hls.js"); // install with: npm i hls.js
            const Hls = (mod as any).default || mod;
            if (Hls?.isSupported()) {
              const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 60 });
              hlsRef.current = hls;
              hls.attachMedia(video);
              hls.on(Hls.Events.MEDIA_ATTACHED, () => { hls.loadSource(src); });
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setReady(true);
                if (autoPlay) void safePlay(video);
              });
              hls.on(Hls.Events.ERROR, (_: any, data: any) => {
                if (data?.fatal) {
                  try { hls.destroy(); } catch {}
                  hlsRef.current = null;
                  video.src = src; video.load(); if (autoPlay) void safePlay(video);
                }
              });
            } else {
              video.src = src; video.load(); if (autoPlay) void safePlay(video); setReady(true);
            }
          } catch {
            video.src = src; video.load(); if (autoPlay) void safePlay(video); setReady(true);
          }
        })();
      }
    } else {
      video.src = src;
      video.load();
      if (autoPlay) void safePlay(video);
      setReady(true);
    }

    return () => {
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        try { video.pause(); } catch {}
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
        muted={muted}
        playsInline={playsInline}
        preload={preload}
        onEnded={() => onVideoEnded?.()}
        onError={(e) => onError?.(e)}
        controls
      />
      <div className="absolute left-2 bottom-2 text-xs px-2 py-1 rounded bg-black/60 text-white pointer-events-none">
        {isStandby ? "Standby" : programTitle || (ready ? "Playing" : "Loading…")}
      </div>
    </div>
  );
});

export default VideoPlayer;

async function safePlay(video: HTMLVideoElement) {
  try {
    if (!video.muted) video.muted = true;
    await video.play();
  } catch {}
}
