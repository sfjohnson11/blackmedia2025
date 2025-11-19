import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import type { Channel } from "@/lib/supabase";

export default async function HomePage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("channels")
    .select(
      "id, name, slug, description, logo_url, youtube_channel_id, youtube_is_live"
    );

  const channels = (data ?? []).sort((a, b) => Number(a.id) - Number(b.id));

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="px-4 py-8 border-b border-gray-800">
        <h1 className="text-3xl font-extrabold">Black Truth TV</h1>
        <p className="text-gray-300 mt-2">
          Streaming live and on-demand. Choose a channel to start watching.
        </p>

        <div className="mt-6 flex">
          <Link href="/on-demand" className="mx-auto">
            <button className="rounded-lg bg-red-600 px-6 py-3 font-semibold">
              🎬 Watch On-Demand
            </button>
          </Link>
        </div>
      </section>

      <section className="px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {channels.map((ch: Channel) => (
            <Link
              key={ch.id}
              href={`/watch/${ch.id}`}
              className="rounded-xl overflow-hidden border border-gray-800 bg-gray-900"
            >
              <div className="aspect-video bg-black">
                {ch.logo_url ? (
                  <img
                    src={ch.logo_url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div>No artwork</div>
                )}
              </div>

              <div className="p-3">
                <div className="font-semibold">{ch.name}</div>
                <div className="text-xs text-gray-400">Channel {ch.id}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
