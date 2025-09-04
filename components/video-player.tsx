// components/video-player.tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  poster?: string;
  programTitle?: string;
  isStandby?: boolean;
  onVideoEnded?: () => void;
  onError?: () => void;                  // 👈 added
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
  onError,                                // 👈 added
  autoPlay = false,
  muted = false,
  playsInline = true,
  preload = "metadata",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Ensure attributes before source attach
    video.controls = true;
    video.muted = muted;
    (video as any).playsInline = playsInline;
    (video as any).webkitPlaysInline = playsInline;

    let cleanupHls: (() => void) | null = null;

    async function setup() {
      const isHls = /\.m3u8($|\?)/i.test(src);

      if (isHls && (video as any).canPlayType("application/vnd.apple.mpegurl") === "") {
        const { default: Hls, Events } = await import("hls.js");
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hls.loadSource(src);
          hls.attachMedia(video);
          // Forward fatal HLS errors to the onError handler so the page can swap to standby
          hls.on(Events.ERROR, (_ev: any, data: any) => {
            if (data?.fatal && typeof onError === "function") onError();
          });
          cleanupHls = () => hls.destroy();
        } else {
          video.src = src; // fallback
        }
      } else {
        video.src = src; // MP4 or native HLS
      }

      // Reload metadata so the big play button & timeline show up correctly
      video.load();

      if (autoPlay) {
        try {
          await video.play();
        } catch {
          // If autoplay is blocked, user can click big play; controls are visible.
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
  }, [src, autoPlay, muted, playsInline, onError]); // 👈 include onError for correctness

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
        onError={onError}                 // 👈 wire native <video> errors too
        controlsList="nodownload"
        aria-label={programTitle || (isStandby ? "Standby" : "Video")}
      />
    </div>
  );
}
