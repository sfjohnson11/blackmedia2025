"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

// Supabase client using your existing env keys
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AdminTool = {
  href: string;
  title: string;
  description: string;
};

const ADMIN_TOOLS: AdminTool[] = [
  {
    href: "/admin/add-channel",
    title: "Add Channel",
    description: "Create new Black Truth TV channels and configure settings.",
  },
  {
    href: "/admin/auto-schedule",
    title: "Auto-Schedule",
    description: "Auto-generate weekly schedules for all or selected channels.",
  },
  {
    href: "/admin/channel-live",
    title: "Channel Live Monitor",
    description: "Check and manage live status for channels.",
  },
  {
    href: "/admin/channel-manager",
    title: "Channel Manager",
    description: "Edit channel names, logos, and basic details.",
  },
  {
    href: "/admin/cleanup-programs",
    title: "Cleanup Programs",
    description: "Find and clean up duplicate or broken program records.",
  },
  {
    href: "/admin/continue",
    title: "Continue Setup / Tools",
    description: "Return to ongoing admin setup and workflows.",
  },
  {
    href: "/admin/database-inspector",
    title: "Database Inspector",
    description: "Inspect and troubleshoot Supabase tables for Black Truth TV.",
  },
  {
    href: "/admin/freedom-school-library",
    title: "Freedom School Library",
    description: "Manage Freedom School lessons, videos, and resources.",
  },
  {
    href: "/admin/invite-codes",
    title: "Invite Codes",
    description: "Create and manage invite codes for new users.",
  },
  {
    href: "/admin/library-manager",
    title: "On-Demand Library Manager",
    description: "Organize on-demand videos and categories.",
  },
  {
    href: "/admin/news",
    title: "News Manager",
    description: "Manage news items, ticker messages, and highlights.",
  },
  {
    href: "/admin/program-titles",
    title: "Program Titles",
    description: "Standardize and edit program titles across channels.",
  },
  {
    href: "/admin/programs",
    title: "Programs Manager",
    description: "Add, edit, and assign programs to channels.",
  },
  {
    href: "/admin/refresh-programs",
    title: "Refresh Programs",
    description: "Refresh program metadata and sync schedules.",
  },
  {
    href: "/admin/reset-programs",
    title: "Reset Programs",
    description: "Reset daily/weekly schedules back to defaults.",
  },
];

export default function AdminPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      // 1️⃣ Get current Supabase user
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Error getting user in /admin:", error.message);
      }

      // Not logged in → send to login and come back to /admin
      if (!user || !user.email) {
        router.replace("/login?redirect=/admin");
        return;
      }

      // 2️⃣ Look up profile BY EMAIL (matches your user_profiles table)
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("email", user.email)
        .maybeSingle();

      if (profileError) {
        console.error("Error loading profile in /admin:", profileError.message);
      }

      const role = (profile?.role || "member").toLowerCase().trim();

      // Not admin → dump them back to viewer site
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

  // ✅ If we got here, user is admin
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Black Truth TV — Admin</h1>
        <p className="text-sm text-gray-300">
          Control channels, programs, Freedom School, and more from this admin
          hub.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {ADMIN_TOOLS.map((tool) => (
          <AdminCard
            key={tool.href}
            href={tool.href}
            title={tool.title}
            description={tool.description}
          />
        ))}
      </section>

      <div className="mt-6">
        <Link
          href="/"
          className="text-sm text-gray-300 underline hover:text-white"
        >
          ← Back to Black Truth TV main site
        </Link>
      </div>
    </main>
  );
}

type AdminCardProps = {
  href: string;
  title: string;
  description: string;
};

function AdminCard({ href, title, description }: AdminCardProps) {
  return (
    <Link href={href}>
      <div className="h-full cursor-pointer rounded-xl border border-gray-700 bg-gray-900/70 p-4 hover:border-red-500 hover:bg-gray-900 transition-colors">
        <h2 className="text-lg font-semibold mb-1">{title}</h2>
        <p className="text-xs text-gray-300">{description}</p>
      </div>
    </Link>
  );
}
