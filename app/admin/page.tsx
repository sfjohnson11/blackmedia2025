// app/admin/page.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
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

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    channelCount: 0,
    programCount: 0,
    loading: true,
  });

  // Fetch counts via server API (avoids RLS headaches in client)
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
        {
          name: "Import Programs (CSV)",
          href: "/setup/import-programs",
          icon: <Upload className="h-4 w-4" />,
        },
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
          description:
            "Clean up program titles without touching schedule details",
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
          description:
            "Send details to Channel Manager to create a new channel",
        },
        {
          name: "Update Channel Images",
          href: "/setup/upload-channel-image",
          icon: <ImageIcon className="h-4 w-4" />,
          description: "Upload or replace channel thumbnails",
        },
        {
          name: "Browse Channels",
          href: "/channels",
          icon: <Users className="h-4 w-4" />,
        },
        {
          name: "Add Channel 31 — Music Only",
          href: "/admin/channel-manager?create=31&name=Music%20Only&bucket=channel31",
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
        {/* DEBUG BANNER – you can remove this once everything is working */}
        <div className="mb-6 rounded-lg border border-amber-400/60 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-amber-300">
            ✅ You are on the{" "}
            <span className="font-bold">Black Truth TV Admin Dashboard</span>{" "}
            (/admin)
          </p>
        </div>

        {/* Header */}
        <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Black Truth TV Admin
            </h1>
            <p className="mt-1 text-sm text-gray-300">
              Operate your Black Truth TV platform – channels, programs, and
              system tools.
            </p>
          </div>
        </header>

        {/* Stats */}
        <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="border border-slate-700 bg-slate-900/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Channels
              </CardTitle>
              <Users className="h-4 w-4 text-sky-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-400">
                {stats.loading ? "…" : stats.channelCount}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Channels currently configured in the system.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-slate-700 bg-slate-900/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Programs
              </CardTitle>
              <Calendar className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-400">
                {stats.loading ? "…" : stats.programCount}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                On-air and scheduled programs across all channels.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Sections */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {adminSections.map((section, index) => (
            <Card
              key={index}
              className="flex h-full flex-col border border-slate-700 bg-slate-900/70"
            >
              <CardHeader>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800">
                    {section.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {section.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-300">
                      {section.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-5 pt-0">
                <div className="space-y-2">
                  {section.links.map((link, linkIndex) => {
                    if (link.flag === "beta" && !ADMIN_BETA) return null;

                    const accentClasses =
                      link.accent === "primary"
                        ? "border-amber-400/40 bg-slate-800/80 ring-1 ring-amber-400/40"
                        : link.accent === "danger"
                        ? "border-red-500/50 bg-red-950/50 ring-1 ring-red-500/40"
                        : "border-slate-700 bg-slate-800/80";

                    return (
                      <Link key={linkIndex} href={link.href} className="block">
                        <Button
                          variant="outline"
                          className={`flex w-full items-center justify-start gap-2 text-left text-sm hover:bg-slate-700 ${accentClasses}`}
                          title={link.description || undefined}
                        >
                          {link.icon}
                          <span>{link.name}</span>
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Reset Programs (danger-gated + confirmed) */}
          {ALLOW_DANGER && (
            <Card className="border border-red-900/60 bg-red-950/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-red-300">
                  <RefreshCw className="h-4 w-4" />
                  Reset Programs
                </CardTitle>
                <CardDescription className="text-xs text-red-200/80">
                  Delete all programs and start fresh.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-red-100/80">
                  This is irreversible. Use this only if your schedule is badly
                  broken or full of duplicate data. All programs will be
                  deleted and can only be restored from backups or re-imports.
                </p>
              </CardContent>
              <CardFooter>
                <ConfirmLink
                  href="/admin/reset-programs"
                  label="Reset Programs"
                />
              </CardFooter>
            </Card>
          )}
        </section>

        {/* Client-side Clear Cache */}
        <section className="mt-10">
          <ClearCacheCard />
        </section>
      </div>
    </div>
  );
}
