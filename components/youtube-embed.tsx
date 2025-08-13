"use client";

type Props =
  | { videoId: string; channelId?: never; title?: string; muted?: boolean }
  | { channelId: string; videoId?: never; title?: string; muted?: boolean };

export default function YouTubeEmbed(props: Props) {
  const { title = "Live Stream", muted = true } = props;

  const src =
    "videoId" in props
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(props.videoId)}?autoplay=1&playsinline=1&rel=0&modestbranding=1&controls=1${muted ? "&mute=1" : ""}`
      : `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(props.channelId)}&autoplay=1&playsinline=1&rel=0&modestbranding=1&controls=1${muted ? "&mute=1" : ""}`;

  return (
    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
      <iframe
        className="absolute inset-0 h-full w-full"
        src={src}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
