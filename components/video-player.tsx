// components/video-player.tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  poster?: string;
  programTitle?: string;
  isStandby?: boolean;
  onVideoEnded?: () => void;
  onError?: () => void;                  // used for standby fallback on runtime errors
  autoPlay?: boolean;                    // default false
  muted?: boolean;                       // default false
  playsInline?: boolean;                 // default true
  preload?: "auto" | "metadata" | "none"; // default "metadata"
};

export default function VideoPlayer({
  src,
  poster,
  programTitle,
  isStandby,
  onVideoEnded,
  onError,
  autoPlay = false,
  muted = false,
  playsInline = true,
  preload = "metadata",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // ensure attributes before source attach
    video.controls = true;
    video.muted = muted;
    (video as any).playsInline = playsInline;
    (video as any).webkitPlaysInline = playsInline;

    let cleanupHls: (() => void) | null = null;

    async function setup() {
      const isHls = /\.m3u8($|\?)/i.test(src);

      // if native HLS not supported, use hls.js
      if (isHls && (video as any).canPlayType("application/vnd.apple.mpegurl") === "") {
        const { default: Hls, Events } = await import("hls.js");
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Events.ERROR, (_ev: any, data: any) => {
            if (data?.fatal && typeof onError === "function") onError();
          });
          cleanupHls = () => hls.destroy();
        } else {
          video.src = src; // fallback
        }
      } else {
        video.src = src;
      }

      video.load();

      if (autoPlay) {
        try {
          await video.play();
        } catch {
          // autoplay blocked → user clicks big play
        }
      }
    }

    setup();

    return () => {
      if (cleanupHls) cleanupHls();
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {}
    };
  }, [src, autoPlay, muted, playsInline, onError]);

  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={poster}
        controls
        muted={muted}
        playsInline={playsInline}
        preload={preload}
        onEnded={onVideoEnded}
        onError={onError}
        controlsList="nodownload"
        aria-label={programTitle || (isStandby ? "Standby" : "Video")}
      />
    </div>
  );
}
