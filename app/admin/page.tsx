"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // NOT logged in → redirect to login
      if (!user || !user.email) {
        router.replace("/login?redirect=/admin");
        return;
      }

      // Check role BY EMAIL
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("email", user.email)
        .maybeSingle();

      const role = (profile?.role || "member").toLowerCase();

      // NOT admin → redirect to home page
      if (role !== "admin") {
        router.replace("/");
        return;
      }

      // Admin OK
      setChecking(false);
    }

    checkAdmin();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  // ADMIN CONTENT — WORKS OUT OF THE BOX
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Black Truth TV — Admin</h1>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <AdminCard href="/admin/programs" title="Programs Manager" />
        <AdminCard href="/admin/scheduler" title="Scheduler" />
        <AdminCard href="/admin/news" title="News Manager" />
        <AdminCard href="/admin/library-manager" title="On-Demand Library" />
        <AdminCard
          href="/admin/freedom-school-library"
          title="Freedom School Library"
        />
        <AdminCard href="/" title="Back to Viewer Site" />
      </div>
    </main>
  );
}

function AdminCard({ href, title }) {
  return (
    <Link href={href}>
      <div className="cursor-pointer rounded-xl border border-gray-700 bg-gray-900 p-4 hover:border-red-500 transition">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
    </Link>
  );
}
