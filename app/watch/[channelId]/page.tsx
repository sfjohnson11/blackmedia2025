// app/watch/[channelId]/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import WatchClient from "./watch-client";

export default function Page({ params }: { params: { channelId: string } }) {
  // No data fetching here. No env reads. No Supabase. Nothing that can throw on the server.
  return <WatchClient channelId={params.channelId} />;
}
