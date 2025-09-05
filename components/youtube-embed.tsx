// components/youtube-embed.tsx
"use client";

type Props = {
  channelId: string;  // YouTube Channel ID
  title?: string;
  muted?: boolean;
};

export default function YouTubeEmbed({ channelId, title, muted = true }: Props) {
  const src =
    `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channelId)}` +
    `&autoplay=1&controls=1&mute=${muted ? "1" : "0"}`;

  return (
    <iframe
      className="w-full h-full"
      src={src}
      title={title || "YouTube Live"}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}
