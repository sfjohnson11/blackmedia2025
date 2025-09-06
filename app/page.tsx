// app/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { Channel } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("channels")
    .select("id, name, slug, description, logo_url, youtube_channel_id, youtube_is_live")
    .order("id", { ascending: true });

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <h1 className="text-2xl font-bold mb-2">Black Truth TV</h1>
        <div className="text-gray-300">Couldn’t load channels: {error.message}</div>
      </div>
    );
  }

  const channels = (data ?? []) as Channel[];

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="px-4 md:px-10 py-8 border-b border-gray-800 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15),rgba(0,0,0,0))]">
        <h1 className="text-3xl md:text-4xl font-extrabold">Black Truth TV</h1>
        <p className="text-gray-300 mt-2 max-w-2xl">Streaming live and on-demand. Choose a channel to start watching.</p>
      </section>

      <section className="px-4 md:px-10 py-6">
        {channels.length === 0 ? (
          <div className="text-gray-400">No channels available.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {channels.map((ch) => {
              const art = ch.logo_url || null;
              const isCh21YouTube = ch.id === 21 && !!(ch.youtube_channel_id || "").trim();
              return (
                <Link
                  href={`/watch/${ch.id}`}
                  key={ch.id}
                  className="group relative rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-colors bg-gray-900"
                >
                  <div className="absolute left-2 top-2 z-10">
                    <span className="inline-flex items-center rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-white/20">
                      Ch {ch.id}
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
                        alt={ch.name ?? `Channel ${ch.id}`}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-gray-500 text-sm">No artwork</div>
                    )}
                  </div>

                  <div className="p-3">
                    <div className="text-base font-semibold truncate">{ch.name ?? `Channel ${ch.id}`}</div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      Channel {ch.id}{isCh21YouTube ? " • YouTube Live" : ""}
                    </div>
                    {ch.description ? (
                      <div className="text-xs text-gray-400 line-clamp-2 mt-1">{ch.description}</div>
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
