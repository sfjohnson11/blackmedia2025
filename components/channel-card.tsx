import Link from "next/link";
import type { Channel } from "@/types";
import { cleanChannelName } from "@/lib/utils";
import { PROTECTED_CHANNELS } from "@/lib/protected-channels";
import { Lock } from "lucide-react";

interface ChannelCardProps {
  channel: Channel;
}

export function ChannelCard({ channel }: ChannelCardProps) {
  const idNum =
    typeof channel.id === "string" ? Number.parseInt(channel.id, 10) : (channel.id as number);

  const cleanedName = cleanChannelName(channel.name ?? `Channel ${idNum}`);
  const needsPassword = PROTECTED_CHANNELS.has(idNum);

  // Use logo_url only; clean fallback text
  const imageUrl =
    channel.logo_url ||
    `https://placehold.co/400x225?text=${encodeURIComponent(cleanedName)}`;

  return (
    <Link
      href={`/watch/${channel.id}`} // middleware will redirect to /unlock/<id> when needed
      className="block"
      aria-label={`Open ${cleanedName}${needsPassword ? " (password protected)" : ""}`}
    >
      <div className="netflix-card group bg-gray-800 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-700 hover:border-red-500">
        <div className="relative aspect-video">
          <img
            src={imageUrl}
            alt={`${cleanedName} channel artwork`}
            loading="lazy"
            className="object-cover w-full h-full"
          />

          {needsPassword && (
            <div className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-full">
              <Lock className="h-4 w-4 text-red-500" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
            <span className="text-lg font-bold text-white">
              {needsPassword ? "Password Protected" : "Watch Now"}
            </span>
          </div>
        </div>

        <div className="p-3">
          <h3 className="font-bold text-white truncate">{cleanedName}</h3>
          <p className="text-xs text-gray-400 mt-1">
            Channel {idNum}
            {needsPassword && (
              <span className="ml-2 inline-flex items-center">
                <Lock className="h-3 w-3 text-red-500 mr-1" />
                Protected
              </span>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
