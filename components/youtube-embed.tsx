// components/youtube-embed.tsx
"use client";

type Props = {
  /** EITHER pass channelId (UC...) for live_stream OR pass videoId (11 chars). */
  channelId?: string;
  videoId?: string;
  title?: string;
  muted?: boolean;
  className?: string;
};

/**
 * If you pass `channelId`, we embed YouTube's "always show the channel's live" URL:
 *   https://www.youtube.com/embed/live_stream?channel=UCxxxx
 * If you pass `videoId`, we embed that exact video.
 */
export default function YouTubeEmbed({
  channelId,
  videoId,
  title = "YouTube Live",
  muted = true,
  className = "",
}: Props) {
  const qs = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    rel: "0",
    playsinline: "1",
    modestbranding: "1",
  }).toString();

  const src = videoId
    ? `https://www.youtube.com/embed/${videoId}?${qs}`
    : `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
        channelId || ""
      )}&${qs}`;

  return (
    <div className={`w-full h-full aspect-video bg-black ${className}`}>
      <iframe
        title={title}
        src={src}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="w-full h-full border-0"
      />
    </div>
  );
}
