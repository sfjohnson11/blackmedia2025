"use client";

import type { Channel } from "@/types";
import { ChannelCard } from "@/components/channel-card";
import { useMemo } from "react";

interface ChannelGridProps {
  channels: Channel[];
}

function parseIdToNumber(id: string | number): number | null {
  if (typeof id === "number" && Number.isFinite(id)) return id;
  const n = Number.parseInt(String(id), 10);
  return Number.isNaN(n) ? null : n;
}

export function ChannelGrid({ channels }: ChannelGridProps) {
  const sortedChannels = useMemo(() => {
    const copy = [...channels];

    copy.sort((a, b) => {
      const aNum = parseIdToNumber(a.id as any);
      const bNum = parseIdToNumber(b.id as any);

      // If both numeric, sort numerically
      if (aNum !== null && bNum !== null) return aNum - bNum;

      // If only one is numeric, put numeric first
      if (aNum !== null && bNum === null) return -1;
      if (aNum === null && bNum !== null) return 1;

      // Fallback: lexicographic by string id
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    });

    return copy;
  }, [channels]);

  if (!sortedChannels.length) {
    return (
      <div className="w-full py-12 text-center text-sm text-gray-400">
        No channels available.
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
      role="list"
      aria-label="Channels"
    >
      {sortedChannels.map((channel) => (
        <div key={String(channel.id)} role="listitem">
          <ChannelCard channel={channel} />
        </div>
      ))}
    </div>
  );
}
