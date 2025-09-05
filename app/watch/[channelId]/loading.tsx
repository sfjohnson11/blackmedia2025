// app/watch/[channelId]/loading.tsx
export default function WatchLoading() {
  return (
    <div className="min-h-[60vh] grid place-items-center bg-black text-white">
      <div className="flex flex-col items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-yellow-400" />
        <p className="mt-3 text-sm text-white/70">Loading channel…</p>
      </div>
    </div>
  );
}
