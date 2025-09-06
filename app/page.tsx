// app/page.tsx
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
  youtube_channel_id?: string | null;
  youtube_is_live?: boolean | null;
  is_active?: boolean | null;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function HomePage() {
  // Server-side Supabase client is fine here (read-only, anon key)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await supabase
    .from("channels")
    .select("id, name, slug, description, logo_url, youtube_channel_id, youtube_is_live, is_active")
    .eq("is_active", true)
    .order("id", { ascending: true });

  const channels: Channel[] = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name ?? null,
    slug: r.slug ?? null,
    description: r.description ?? null,
    logo_url: r.logo_url ?? null,
    youtube_channel_id: r.youtube_channel_id ?? null,
    youtube_is_live: r.youtube_is_live ?? null,
    is_active: r.is_active ?? null,
  }));

  const channelsSorted = [...channels].sort((a, b) => {
    const na = num(a.id), nb = num(b.id);
    if (na !== null && nb !== null) return na - nb;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });

  return (
    <div className="min-h-screen bg-black text-white">
      {/* NAV BAR */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 md:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-extrabold tracking-tight text-lg md:text-xl">
            Black Truth TV
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-white/80 hover:text-white">Home</Link>
            <Link href="/about" className="text-white/80 hover:text-white">About</Link>
            <Link href="/watch/21" className="text-white/80 hover:text-white">Live</Link>
            <Link href="/watch/1" className="text-white/80 hover:text-white">Channel 1</Link>
            <Link href="/watch/3" className="text-white/80 hover:text-white">Channel 3</Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="px-4 md:px-10 py-8 md:py-10 border-b border-gray-800 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15),rgba(0,0,0,0))]">
        <h1 className="text-3xl md:text-4xl font-extrabold">Black Truth TV</h1>
        <p className="text-gray-300 mt-2 max-w-2xl">
          Streaming live and on-demand. Choose a channel to start watching.
        </p>
      </section>

      {/* CHANNEL GRID */}
      <section className="px-4 md:px-10 py-6">
        {error ? (
          <div className="text-gray-300">Couldn’t load channels: {error.message}</div>
        ) : channelsSorted.length === 0 ? (
          <div className="text-gray-400">No channels available.</div>
        ) : (
          <div className="mx-auto max-w-7xl grid grid-flow-row gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {channelsSorted.map((ch) => {
              const art = ch.logo_url || null;
              const chNum = num(ch.id) ?? String(ch.id);
              const hrefId =
                ch.slug && ch.slug.trim().length > 0
                  ? ch.slug!.trim()
                  : String(ch.id);

              const isCh21YouTube =
                (num(ch.id) === 21) && !!(ch.youtube_channel_id || "").trim();

              return (
                <Link
                  href={`/watch/${encodeURIComponent(hrefId)}`}
                  key={String(ch.id)}
                  className="group relative rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-colors bg-gray-900"
                >
                  <div className="absolute left-2 top-2 z-10">
                    <span className="inline-flex items-center rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-white/20">
                      Ch {chNum}
                    </span>
                  </div>

                  {isCh21YouTube && (
                    <div className="absolute right-2 top-2 z-10">
                      <span className="inline-flex items-center rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold">
                        LIVE
                      </span>
                    </div>
                  )}

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
                    <div className="mt-0.5 text-xs text-gray-400">
                      Channel {chNum}{isCh21YouTube ? " • YouTube Live" : ""}
                    </div>

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

      {/* FOOTER */}
      <footer className="px-4 md:px-10 py-10 text-xs text-white/60 border-t border-white/10">
        © {new Date().getFullYear()} Black Truth TV
      </footer>
    </div>
  );
}
