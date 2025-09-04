// app/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic"; // render at request time (not at build)
export const revalidate = 0;

type Channel = {
  id: string;            // supports numeric ids like "21" and slugs like "freedom_school"
  name: string | null;
  description?: string | null;
  image_url?: string | null;
};

function ChannelCard({ ch }: { ch: Channel }) {
  return (
    <Link
      href={`/watch/${ch.id}`}
      className="group rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-colors bg-gray-900"
    >
      <div className="aspect-video bg-black overflow-hidden">
        {ch.image_url ? (
          // using <img> to avoid Next/Image domain config issues
          <img
            src={ch.image_url}
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

  // Server-side Supabase client using anon key for public read
  const supabase = createClient(url, anon);

  // Pull visible channels; adjust table/columns to match your schema exactly
  const { data, error } = await supabase
    .from("channels")
    .select("id, name, description, image_url")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="pt-14 min-h-screen px-4 md:px-10 flex items-center justify-center">
        <div className="max-w-xl w-full bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Couldn’t load channels</h1>
          <p className="text-gray-300">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  const channels: Channel[] = (data ?? []).map((r: any) => ({
    id: String(r.id),
    name: r.name ?? null,
    description: r.description ?? null,
    image_url: r.image_url ?? null,
  }));

  return (
    <div className="pt-14 min-h-screen">
      {/* Hero / cover header */}
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
