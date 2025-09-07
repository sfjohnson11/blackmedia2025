// components/video-player.tsx
"use client";

import React, { forwardRef, useImperativeHandle, useRef } from "react";

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
  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        src={src}
        autoPlay={autoPlay}
        muted={muted}
        playsInline={playsInline}
        preload={preload}
        onEnded={() => onVideoEnded?.()}
        onError={(e) => onError?.(e)}
        controls
      />
      <div className="absolute left-2 bottom-2 text-xs px-2 py-1 rounded bg-black/60 text-white pointer-events-none">
        {/* FIX: Prefer program title over standby flag */}
        {programTitle ? programTitle : (isStandby ? "Standby" : "Playing")}
      </div>
    </div>
  );
});

export default VideoPlayer;
