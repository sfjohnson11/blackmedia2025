"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string;
  logoUrl?: string;              // <- show your channel logo while loading
  isStandby?: boolean;
  programTitle?: string;
  autoPlay?: boolean;
  playsInline?: boolean;
  preload?: "auto" | "metadata" | "none";
  onVideoEnded?: () => void;
  onError?: (e?: any) => void;
};

const VideoPlayer = forwardRef<HTMLVideoElement, Props>(function VideoPlayer(
  {
    src,
    poster,
    logoUrl,
    isStandby = false,
    programTitle,
    autoPlay = true,
    playsInline = true,
    preload = "auto",
    onVideoEnded,
    onError,
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(true);

  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

  useEffect(() => {
    // each source change → show loading again
    setLoading(true);
  }, [src]);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        src={src}
        autoPlay={autoPlay}
        // start muted to satisfy autoplay, unmute on first 'playing'
        muted
        playsInline={playsInline}
        preload={preload}
        onEnded={() => onVideoEnded?.()}
        onWaiting={() => setLoading(true)}
        onLoadedData={() => setLoading(true)}
        onCanPlay={() => setLoading(true)}
        onPlaying={() => {
          // unmute once we’re clearly playing
          try {
            if (videoRef.current) {
              videoRef.current.muted = false;
              videoRef.current.volume = 1.0;
            }
          } catch {}
          setLoading(false);
        }}
        onError={(e) => {
          setLoading(false);
          onError?.(e);
        }}
        controls
      />

      {/* bottom-left status pill */}
      <div className="absolute left-2 bottom-2 text-xs px-2 py-1 rounded bg-black/60 text-white pointer-events-none">
        {isStandby ? "Standby" : programTitle || "Playing"}
      </div>

      {/* Loading overlay with logo + scrolling ticker */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black">
          <div className="flex flex-col items-center gap-4 px-6">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Channel Logo"
                className="h-24 w-24 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]"
              />
            ) : null}

            <div className="w-[80%] max-w-xl overflow-hidden rounded-full border border-white/10 bg-white/5">
              <div className="relative h-9">
                <div className="absolute inset-0 flex items-center">
                  <div className="ticker whitespace-nowrap will-change-transform">
                    <span className="mx-4 text-sm text-white/80">
                      Loading video… preparing stream…
                    </span>
                    <span className="mx-4 text-sm text-white/80">
                      {programTitle ? `Up Next: ${programTitle}` : "Please wait…"}
                    </span>
                    <span className="mx-4 text-sm text-white/80">Connecting to CDN…</span>
                    <span className="mx-4 text-sm text-white/80">Almost there…</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-white/60">If this takes a while, your network may be slow.</div>
          </div>

          {/* styled-jsx ticker animation */}
          <style jsx>{`
            .ticker {
              display: inline-block;
              animation: tickerScroll 10s linear infinite;
            }
            @keyframes tickerScroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
