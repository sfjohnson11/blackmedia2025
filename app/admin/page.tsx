// app/admin/page.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Upload,
  Database,
  Image as ImageIcon,
  Users,
  Calendar,
  RefreshCw,
  Lock,
  Radio,
  FileVideo,
  Code,
  Edit,
  Music2,
  PlayCircle,
  PlusCircle,
  Tv2,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ConfirmLink from "@/components/ConfirmLink";
import ClearCacheCard from "@/components/ClearCacheCard";
import { ADMIN_BETA, ALLOW_DANGER } from "@/lib/flags";

type Stats = {
  channelCount: number;
  programCount: number;
  loading: boolean;
};

type AdminLink = {
  name: string;
  href: string;
  icon: ReactNode;
  accent?: "primary" | "danger" | "neutral";
  flag?: "beta";
  description?: string;
};

type AdminSection = {
  title: string;
  description: string;
  icon: ReactNode;
  links: AdminLink[];
};

type UserProfile = {
  id: string;
  role: string | null;
  email?: string | null;
};

export default function AdminPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (sessionError) {
          console.error("Error getting session", sessionError);
          router.replace("/login?redirect=/admin");
          return;
        }

        if (!session) {
          router.replace("/login?redirect=/admin");
          return;
        }

        const authUser = session.user;
        let role: string | null = null;

        // 1️⃣ Try profile by email
        if (authUser.email) {
          const { data: byEmail, error: emailError } = await supabase
            .from("user_profiles")
            .select("id, role, email")
            .eq("email", authUser.email)
            .maybeSingle<UserProfile>();

          if (emailError) {
            console.error(
              "Error loading profile by email:",
              emailError.message
            );
          }

          if (byEmail?.role) {
            role = byEmail.role;
          }
        }

        // 2️⃣ Fallback: profile by id
        if (!role) {
          const { data: byId, error: idError } = await supabase
            .from("user_profiles")
            .select("id, role, email")
            .eq("id", authUser.id)
            .maybeSingle<UserProfile>();

          if (idError) {
            console.error("Error loading profile by id:", idError.message);
          }

          if (byId?.role) {
            role = byId.role;
          }
        }

        const finalRole = (role || "member").toLowerCase().trim();

        if (finalRole !== "admin") {
          router.replace("/");
          return;
        }

        setChecking(false);
      } catch (e) {
        console.error("Unexpected admin check error", e);
        if (!cancelled) router.replace("/login?redirect=/admin");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white flex items-center justify-center">
        <p className="text-sm text-slate-300">Checking admin access…</p>
      </div>
    );
  }

  return <AdminDashboardInner />;
}

function AdminDashboardInner() {
  const [stats, setStats] = useState<Stats>({
    channelCount: 0,
    programCount: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        setStats({
          channelCount: json.channelCount ?? 0,
          programCount: json.programCount ?? 0,
          loading: false,
        });
      } catch {
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const adminSections: AdminSection[] = [
    {
      title: "Scheduling & Programs",
      description: "Build and adjust the 24/7 lineup quickly.",
      icon: <Calendar className="h-8 w-8 text-emerald-400" />,
      links: [
        {
          name: "Programs Manager",
          href: "/admin/programs",
          icon: <Edit className="h-4 w-4" />,
          accent: "primary",
          description:
            "Per-channel day view with create / edit / delete / CSV import",
        },
        { name: "Import Programs (CSV)", href: "/setup/import-programs", icon: <Upload className="h-4 w-4" /> },
        {
          name: "Refresh Programs",
          href: "/admin/refresh-programs",
          icon: <RefreshCw className="h-4 w-4" />,
          description: "Rebuild scheduled start times for all channels",
        },
        {
          name: "Auto-Schedule from Buckets",
          href: "/admin/auto-schedule",
          icon: <PlayCircle className="h-4 w-4" />,
          description: "Build a full schedule from channel bucket MP4s",
        },
        {
          name: "Program Title Editor",
          href: "/admin/program-titles",
          icon: <Edit className="h-4 w-4" />,
          description: "Clean up program titles without touching schedule",
        },
        {
          name: "On-Demand Library",
          href: "/on-demand",
          icon: <Tv2 className="h-4 w-4" />,
          description: "Browse and test on-demand programs by channel",
        },
        {
          name: "Cleanup Programs",
          href: "/admin/program-cleanup",
          icon: <Trash2 className="h-4 w-4" />,
          accent: "danger",
          description: "Find and remove broken or unwanted program entries",
        },
        {
          name: "View Guide",
          href: "/browse",
          icon: <Calendar className="h-4 w-4" />,
          description: "Public 24-hour guide so you can verify changes",
        },
      ],
    },
    {
      title: "Channels",
      description: "Logos, descriptions, and live flags.",
      icon: <Users className="h-8 w-8 text-sky-400" />,
      links: [
        {
          name: "Channel Manager",
          href: "/admin/channel-manager",
          icon: <Edit className="h-4 w-4" />,
          description: "Edit channel titles, descriptions, and visibility",
        },
        {
          name: "Quick Add Channel",
          href: "/admin/add-channel",
          icon: <PlusCircle className="h-4 w-4" />,
          description: "Send details to Channel Manager to create new channel",
        },
        {
          name: "Update Channel Images",
          href: "/setup/upload-channel-image",
          icon: <ImageIcon className="h-4 w-4" />,
          description: "Upload or replace channel thumbnails",
        },
        { name: "Browse Channels", href: "/channels", icon: <Users className="h-4 w-4" /> },
        {
          name: "Add Channel 31 — Music Only",
          href:
            "/admin/channel-manager?create=31&name=Music%20Only&bucket=channel31",
          icon: <Music2 className="h-4 w-4" />,
          description: "Creates channel 31 and points to bucket channel31",
        },
      ],
    },
    {
      title: "Live & News",
      description: "Live streams and breaking news banners.",
      icon: <Radio className="h-8 w-8 text-rose-400" />,
      links: [
        {
          name: "Live Stream Manager",
          href: "/admin/live-streams",
          icon: <Radio className="h-4 w-4" />,
          description: "Configure and update live stream entries",
        },
        {
          name: "Breaking News",
          href: "/admin/news",
          icon: <Radio className="h-4 w-4" />,
          description: "Set ticker / banners for urgent updates",
        },
      ],
    },
    {
      title: "System",
      description: "Database tools and power features.",
      icon: <Settings className="h-8 w-8 text-amber-400" />,
      links: [
        {
          name: "SQL Setup",
          href: "/setup/sql-setup",
          icon: <Database className="h-4 w-4" />,
          description: "Initial schema / migration helpers",
        },
        {
          name: "Debug Storage",
          href: "/debug",
          icon: <RefreshCw className="h-4 w-4" />,
          description: "Storage + buckets debugging tools",
        },
        {
          name: "Invite Codes",
          href: "/admin/invite-codes",
          icon: <Lock className="h-4 w-4" />,
          description: "Manage invite / access codes",
        },
        {
          name: "SQL Query Tool",
          href: "/admin/sql-query",
          icon: <Code className="h-4 w-4" />,
          flag: "beta",
          description: "Run read-only SQL for quick diagnostics",
        },
        {
          name: "Video Processor",
          href: "/admin/video-processor",
          icon: <FileVideo className="h-4 w-4" />,
          flag: "beta",
          description: "Experimental video processing tools",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <div className="mb-6 rounded-lg border border-amber-400/60 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-amber-300">
            ✅ You are on the{" "}
            <span className="font-bold">Black Truth TV Admin Dashboard</span>{" "}
            (/admin)
          </p>
        </div>

        {/* header, stats, and tool cards */}
        {/* ... as defined above ... */}

        {/* Stats */}
        {/* (kept above) */}

        {/* Tool sections */}
        {/* (kept above) */}

        {/* Clear cache */}
        <section className="mt-10">
          <ClearCacheCard />
        </section>
      </div>
    </div>
  );
}
