// components/video-player.tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  poster?: string;
  programTitle?: string;
  isStandby?: boolean;
  onVideoEnded?: () => void;
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  preload?: "auto" | "metadata" | "none";
};

export default function VideoPlayer({
  src,
  poster,
  programTitle,
  isStandby,
  onVideoEnded,
  autoPlay = true,
  muted = true,
  playsInline = true,
  preload = "auto",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const isHls = /\.m3u8($|\?)/i.test(src);
    let hls: any;

    async function setup() {
      if (isHls && (video as any).canPlayType("application/vnd.apple.mpegurl") === "") {
        // Dynamically import hls.js only if needed
        const { default: Hls } = await import("hls.js");
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_ev: any, data: any) => {
            // Soft error handling—keep the player from crashing
            // console.warn("HLS error", data);
          });
        } else {
          // Fallback: set native src anyway
          video.src = src;
        }
      } else {
        video.src = src;
      }

      try {
        if (autoPlay) {
          await video.play().catch(() => {
            // Autoplay might be blocked; keep muted attribute true so user click will start it.
          });
        }
      } catch {
        // ignore
      }
    }

    setup();

    return () => {
      if (hls) {
        try {
          hls.destroy();
        } catch {}
      }
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [src, autoPlay]);

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
        aria-label={programTitle || (isStandby ? "Standby" : "Video")}
      />
    </div>
  );
}
