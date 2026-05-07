"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Channel } from "@/types";
import { cleanChannelName } from "@/lib/utils";
import { FREE_CHANNELS, MEMBER_ONLY_CHANNELS } from "@/lib/protected-channels";
import { Lock, Heart } from "lucide-react";
import { isFavorited, toggleFavorite } from "@/lib/favorites";

interface ChannelCardProps {
  channel: Channel;
  userTier?: "free" | "member" | "constructiq" | "admin" | null;
  initialFavorited?: boolean;
}

export function ChannelCard({
  channel,
  userTier = null,
  initialFavorited,
}: ChannelCardProps) {
  const idNum =
    typeof channel.id === "string"
      ? Number.parseInt(channel.id, 10)
      : (channel.id as number);
  const cleanedName = cleanChannelName(channel.name ?? `Channel ${idNum}`);
  const imageUrl =
    channel.logo_url ||
    `https://placehold.co/400x225?text=${encodeURIComponent(cleanedName)}`;
  const isFree = FREE_CHANNELS.has(idNum);
  const needsMembership = MEMBER_ONLY_CHANNELS.has(idNum);
  const isUnlocked =
    userTier === "admin" ||
    userTier === "member" ||
    isFree ||
    (userTier === "constructiq" && !needsMembership);

  const href =
    needsMembership && !isUnlocked ? "/membership" : `/watch/${channel.id}`;

  const [favorited, setFavorited] = useState<boolean>(!!initialFavorited);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialFavorited !== undefined) return; // parent told us
    let cancelled = false;
    (async () => {
      const fav = await isFavorited(channel.id);
      if (!cancelled) setFavorited(fav);
    })();
    return () => {
      cancelled = true;
    };
  }, [channel.id, initialFavorited]);

  async function handleHeartClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const nowFavorited = await toggleFavorite(channel.id);
    setFavorited(nowFavorited);
    setBusy(false);
  }

  return (
    <Link
      href={href}
      className="block"
      aria-label={`Open ${cleanedName}${
        needsMembership && !isUnlocked ? " (membership required)" : ""
      }`}
    >
      <div className="netflix-card group bg-gray-800 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-700 hover:border-red-500">
        <div className="relative aspect-video">
          <img
            src={imageUrl}
            alt={`${cleanedName} channel artwork`}
            loading="lazy"
            className="object-cover w-full h-full"
          />

          {/* HEART (top-left) */}
          <button
            type="button"
            onClick={handleHeartClick}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            className={`absolute top-2 left-2 p-1.5 rounded-full transition ${
              favorited
                ? "bg-pink-600/80 hover:bg-pink-600"
                : "bg-black/60 hover:bg-black/80"
            } ${busy ? "opacity-60 cursor-wait" : ""}`}
          >
            <Heart
              className={`h-4 w-4 ${
                favorited ? "fill-white text-white" : "text-white"
              }`}
            />
          </button>

          {needsMembership && !isUnlocked && (
            <div className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-full">
              <Lock className="h-4 w-4 text-yellow-400" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
            <span className="text-lg font-bold text-white">
              {needsMembership && !isUnlocked ? "🔒 Members Only" : "Watch Now"}
            </span>
          </div>
        </div>

        <div className="p-3">
          <h3 className="font-bold text-white truncate">{cleanedName}</h3>
          <p className="text-xs text-gray-400 mt-1">
            Channel {idNum}
            {needsMembership && !isUnlocked && (
              <span className="ml-2 inline-flex items-center text-yellow-400">
                <Lock className="h-3 w-3 mr-1" />
                Members Only
              </span>
            )}
            {isFree && <span className="ml-2 text-green-400">Free</span>}
          </p>
        </div>
      </div>
    </Link>
  );
}
