// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Settings, Upload, Database, Image as ImageIcon, Users, Calendar,
  RefreshCw, Lock, Radio, Clock, FileVideo, Trash2, Code, Edit
} from "lucide-react";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card";
import ConfirmLink from "@/components/ConfirmLink";
import ClearCacheCard from "@/components/ClearCacheCard";
import { ADMIN_BETA, ALLOW_DANGER } from "@/lib/flags";

type Stats = {
  channelCount: number;
  programCount: number;
  loading: boolean;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    channelCount: 0,
    programCount: 0,
    loading: true,
  });

  // Fetch counts via server API to avoid future RLS headaches
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
        if (!cancelled)
          setStats((s) => ({ ...s, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const adminLinks = [
    {
      title: "Channel Management",
      description: "Import, edit, and manage channel data",
      icon: <Users className="h-8 w-8 text-blue-500" />,
      links: [
        { name: "Import Channels", href: "/setup/import", icon: <Upload className="h-4 w-4" /> },
        { name: "Update Channel Images", href: "/setup/upload-channel-image", icon: <ImageIcon className="h-4 w-4" /> },
        { name: "Browse Channels", href: "/channels", icon: <Users className="h-4 w-4" /> },
        { name: "Channel Passwords", href: "/admin/channel-passwords", icon: <Lock className="h-4 w-4" /> },
      ],
    },
    {
      title: "Content Management",
      description: "Manage programs, news, and site content",
      icon: <Calendar className="h-8 w-8 text-green-500" />,
      links: [
        { name: "Import Programs", href: "/setup/import-programs", icon: <Upload className="h-4 w-4" /> },
        { name: "Monday Schedule Helper", href: "/admin/monday-schedule", icon: <Clock className="h-4 w-4" /> },
        { name: "Breaking News", href: "/admin/news", icon: <Radio className="h-4 w-4" /> },
        { name: "Live Stream Manager", href: "/admin/live-streams", icon: <Radio className="h-4 w-4" /> },
        { name: "View Schedule", href: "/browse", icon: <Calendar className="h-4 w-4" /> },
        { name: "Video Processor", href: "/admin/video-processor", icon: <FileVideo className="h-4 w-4" />, flag: "beta" },
        { name: "Refresh Programs", href: "/admin/refresh-programs", icon: <RefreshCw className="h-4 w-4" /> },
        { name: "Channel Manager", href: "/admin/channel-manager", icon: <Edit className="h-4 w-4" /> },
      ],
    },
    {
      title: "System Setup",
      description: "Database and system configuration",
      icon: <Settings className="h-8 w-8 text-red-500" />,
      links: [
        { name: "SQL Setup", href: "/setup/sql-setup", icon: <Database className="h-4 w-4" /> },
        { name: "Debug Storage", href: "/debug", icon: <RefreshCw className="h-4 w-4" /> },
        { name: "SQL Query Tool", href: "/admin/sql-query", icon: <Code className="h-4 w-4" />, flag: "beta" },
      ],
    },
  ] as const;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">Manage your Black Truth TV platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-red-500 mb-1">
            {stats.loading ? "..." : stats.channelCount}
          </h2>
          <p className="text-gray-400">Total Channels</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-red-500 mb-1">
            {stats.loading ? "..." : stats.programCount}
          </h2>
          <p className="text-gray-400">Total Programs</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-red-500 mb-1">29</h2>
          <p className="text-gray-400">Active Channels</p>
        </div>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminLinks.map((section, index) => (
          <div
            key={index}
            className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700"
          >
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mr-4">{section.icon}</div>
                <h2 className="text-xl font-bold">{section.title}</h2>
              </div>
              <p className="text-gray-400 mb-6">{section.description}</p>
              <div className="space-y-2">
                {section.links.map((link, linkIndex) => {
                  // Handle feature flags per link
                  if (link.flag === "beta" && !ADMIN_BETA) return null;

                  return (
                    <Link key={linkIndex} href={link.href} className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left bg-gray-700 hover:bg-gray-600 border-gray-600"
                      >
                        {link.icon}
                        <span className="ml-2">{link.name}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Video Processor card (beta-gated) */}
        {ADMIN_BETA && (
          <Card>
            <CardHeader>
              <CardTitle>Video Processor</CardTitle>
              <CardDescription>Process and fix video URLs</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-4">
                Check and fix video URLs, test playback, and manage program data.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/admin/video-processor" className="w-full">
                <Button className="w-full">Open Video Processor</Button>
              </Link>
            </CardFooter>
          </Card>
        )}

        {/* Reset Programs (danger-gated + confirmed) */}
        {ALLOW_DANGER && (
          <Card className="bg-red-900/10 border-red-900/30">
            <CardHeader>
              <CardTitle className="text-red-400">Reset Programs</CardTitle>
              <CardDescription>Delete all programs and start fresh</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-4">
                Completely reset program data to fix issues with old or duplicate programs.
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

        {/* SQL Tool (beta-gated) */}
        {ADMIN_BETA && (
          <Card className="bg-blue-900/10 border-blue-900/30">
            <CardHeader>
              <CardTitle className="text-blue-400">SQL Query Tool</CardTitle>
              <CardDescription>Run SQL for power management</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-4">
                Execute SQL queries directly against your database for advanced troubleshooting and data management.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/admin/sql-query" className="w-full">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Open SQL Tool
                </Button>
              </Link>
            </CardFooter>
          </Card>
        )}
      </div>

      {/* Client-side Clear Cache (no route) */}
      <ClearCacheCard />
    </div>
  );
}
