// app/page.tsx
import TopNav from "@/components/top-nav";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Channel = {
  id: number | string;
  name: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url?: string | null;
  youtube_is_live?: boolean | null;
  is_active?: boolean | null;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function HomePage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anon);

  // server-side order by id ASC
  const { data, error } = await supabase
    .from("channels")
    .select("id, name, slug, description, logo_url, youtube_is_live, is_active")
    .eq("is_active", true)
    .order("id", { ascending: true });

  const channels: Channel[] = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name ?? null,
    slug: r.slug ?? null,
    description: r.description ?? null,
    logo_url: r.logo_url ?? null,
    youtube_is_live: r.youtube_is_live ?? null,
    is_active: r.is_active ?? null,
  }));

  // client-side numeric sort (extra safety)
  const channelsSorted = [...channels].sort((a, b) => {
    const na = num(a.id), nb = num(b.id);
    if (na !== null && nb !== null) return na - nb;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav />

      <section className="px-4 md:px-10 py-8 md:py-10 border-b border-gray-800 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15),rgba(0,0,0,0))]">
        <h1 className="text-3xl md:text-4xl font-extrabold">Black Truth TV</h1>
        <p className="text-gray-300 mt-2 max-w-2xl">
          Streaming live and on-demand. Choose a channel to start watching.
        </p>
      </section>

      <section className="px-4 md:px-10 py-6">
        {error ? (
          <div className="text-gray-300">Couldn’t load channels: {error.message}</div>
        ) : channelsSorted.length === 0 ? (
          <div className="text-gray-400">No channels available.</div>
        ) : (
          <div className="grid grid-flow-row gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {channelsSorted.map((ch) => {
              const art = ch.logo_url || null;
              const chNum = num(ch.id) ?? String(ch.id);
              return (
                <Link
                  href={`/watch/${encodeURIComponent(String(ch.id))}`}
                  key={String(ch.id)}
                  className="group relative rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-colors bg-gray-900"
                >
                  {/* small number badge */}
                  <div className="absolute left-2 top-2 z-10">
                    <span className="inline-flex items-center rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-white/20">
                      Ch {chNum}
                    </span>
                  </div>

                  <div className="aspect-video bg-black overflow-hidden">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={art}
                        alt={ch.name ?? `Channel ${chNum}`}
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
                      {ch.name ?? `Channel ${chNum}`}
                    </div>
                    {/* show Channel number under the title */}
                    <div className="mt-0.5 text-xs text-gray-400">Channel {chNum}</div>

                    {ch.description ? (
                      <div className="text-xs text-gray-400 line-clamp-2 mt-1">
                        {ch.description}
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
