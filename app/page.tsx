// app/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Channel = {
  id: string;
  name: string | null;
  description?: string | null;
  logo_url?: string | null;      // <-- use logo_url (not image_url)
  channel_number?: number | null;
};

function ChannelCard({ ch }: { ch: Channel }) {
  return (
    <Link
      href={`/watch/${ch.id}`}
      className="group rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-colors bg-gray-900"
    >
      <div className="aspect-video bg-black overflow-hidden">
        {ch.logo_url ? (
          // keep <img> to avoid Next/Image domain config
          <img
            src={ch.logo_url}
            alt={ch.name ?? `Channel ${ch.id}`}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            No artwork
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-base font-semibold truncate">
          {ch.name ?? `Channel ${ch.id}`}
        </div>
        {ch.description ? (
          <div className="text-xs text-gray-400 line-clamp-2 mt-1">{ch.description}</div>
        ) : null}
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) {
    return (
      <div className="pt-14 min-h-screen px-4 md:px-10 flex items-center justify-center">
        <div className="max-w-xl w-full bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Configuration error</h1>
          <p className="text-gray-300">
            Missing <code className="text-gray-200">NEXT_PUBLIC_SUPABASE_URL</code> or{" "}
            <code className="text-gray-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </div>
    );
  }

  const supabase = createClient(url, anon);

  // SAFE: only columns you have; no sort_order, no image_url
  const { data, error } = await supabase
    .from("channels")
    .select("id, name, description, logo_url, channel_number")
    .order("channel_number", { ascending: true }) // if null, we’ll sort by id next
    .order("id", { ascending: true });

  if (error) {
    return (
      <div className="pt-14 min-h-screen px-4 md:px-10 flex items-center justify-center">
        <div className="max-w-xl w-full bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Couldn’t load channels</h1>
          <p className="text-gray-300">{error.message}</p>
        </div>
      </div>
    );
  }

  const channels: Channel[] = (data ?? []).map((r: any) => ({
    id: String(r.id),
    name: r.name ?? null,
    description: r.description ?? null,
    logo_url: r.logo_url ?? null,
    channel_number: r.channel_number ?? null,
  }));

  return (
    <div className="pt-14 min-h-screen">
      {/* Hero */}
      <section className="px-4 md:px-10 py-8 md:py-10 border-b border-gray-800 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15),rgba(0,0,0,0))]">
        <h1 className="text-3xl md:text-4xl font-extrabold">Black Truth TV</h1>
        <p className="text-gray-300 mt-2 max-w-2xl">
          Streaming live and on-demand. Choose a channel to start watching.
        </p>
      </section>

      {/* Channels grid */}
      <section className="px-4 md:px-10 py-6">
        {channels.length === 0 ? (
          <div className="text-gray-400">No channels available.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {channels.map((ch) => (
              <ChannelCard key={ch.id} ch={ch} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
