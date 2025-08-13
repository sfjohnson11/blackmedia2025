// File: app/admin/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Settings, Upload, Database, ImageIcon, Users, Calendar, RefreshCw,
  Lock, Radio, Clock, FileVideo, Trash2, Code, Edit, LogOut
} from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from '@/components/ui/card';

type Stats = {
  channelCount: number;
  programCount: number;
  activeChannelCount: number;
  loading: boolean;
  error?: string | null;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    channelCount: 0,
    programCount: 0,
    activeChannelCount: 0,
    loading: true,
    error: null,
  });

  // 🔒 Soft admin guard
  useEffect(() => {
    (async () => {
      // Check auth
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) {
        router.replace('/login?role=admin');
        return;
      }

      // Check role (adjust table name if yours differs)
      const { data: profile } = await supabase
        .from('user_profiles') // If your table is 'profiles', change here
        .select('role')
        .eq('id', uid)
        .maybeSingle();

      if (profile?.role !== 'admin') {
        router.replace('/login?role=admin');
      }
    })();
  }, [router]);

  // 📊 Stats (concurrent)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStats(s => ({ ...s, loading: true, error: null }));
      try {
        const [
          channelsRes,
          programsRes,
          activeRes,
        ] = await Promise.all([
          supabase.from('channels').select('*', { count: 'exact', head: true }),
          supabase.from('programs').select('*', { count: 'exact', head: true }),
          supabase.from('channels').select('*', { count: 'exact', head: true }).eq('is_active', true),
        ]);

        if (cancelled) return;

        const channelCount = channelsRes.count ?? 0;
        const programCount = programsRes.count ?? 0;
        const activeChannelCount = activeRes.count ?? 0;

        setStats({
          channelCount,
          programCount,
          activeChannelCount,
          loading: false,
          error: null,
        });
      } catch (e: any) {
        if (cancelled) return;
        setStats(s => ({
          ...s,
          loading: false,
          error: e?.message || 'Failed to load stats',
        }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 🧭 Sections config
  const adminLinks = useMemo(() => ([
    {
      title: 'Channel Management',
      description: 'Import, edit, and manage channel data',
      icon: <Users className="h-8 w-8 text-blue-500" />,
      links: [
        { name: 'Import Channels', href: '/setup/import', icon: <Upload className="h-4 w-4" /> },
        { name: 'Update Channel Images', href: '/setup/upload-channel-image', icon: <ImageIcon className="h-4 w-4" /> },
        { name: 'Browse Channels', href: '/channels', icon: <Users className="h-4 w-4" /> },
        { name: 'Channel Passwords', href: '/admin/channel-passwords', icon: <Lock className="h-4 w-4" /> },
      ],
    },
    {
      title: 'Content Management',
      description: 'Manage programs, news, and site content',
      icon: <Calendar className="h-8 w-8 text-green-500" />,
      links: [
        { name: 'Import Programs', href: '/setup/import-programs', icon: <Upload className="h-4 w-4" /> },
        { name: 'Monday Schedule Helper', href: '/admin/monday-schedule', icon: <Clock className="h-4 w-4" /> },
        { name: 'Breaking News', href: '/admin/news', icon: <Radio className="h-4 w-4" /> },
        { name: 'Live Stream Manager', href: '/admin/live-streams', icon: <Radio className="h-4 w-4" /> },
        { name: 'View Schedule', href: '/browse', icon: <Calendar className="h-4 w-4" /> },
        { name: 'Video Processor', href: '/admin/video-processor', icon: <FileVideo className="h-4 w-4" /> },
        { name: 'Refresh Programs', href: '/admin/refresh-programs', icon: <RefreshCw className="h-4 w-4" /> },
        { name: 'Reset Programs', href: '/admin/reset-programs', icon: <Trash2 className="h-4 w-4" /> },
        { name: 'Channel Manager', href: '/admin/channel-manager', icon: <Edit className="h-4 w-4" /> },
      ],
    },
    {
      title: 'System Setup',
      description: 'Database and system configuration',
      icon: <Settings className="h-8 w-8 text-red-500" />,
      links: [
        { name: 'SQL Setup', href: '/setup/sql-setup', icon: <Database className="h-4 w-4" /> },
        { name: 'Debug Storage', href: '/debug', icon: <RefreshCw className="h-4 w-4" /> },
        { name: 'SQL Query Tool', href: '/admin/sql-query', icon: <Code className="h-4 w-4" /> },
      ],
    },
  ]), []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login?role=admin');
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
          <p className="text-gray-400">Manage your Black Truth TV platform</p>
        </div>
        <Button onClick={signOut} variant="outline" className="border-gray-700 hover:bg-white/10">
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-red-500 mb-1">
            {stats.loading ? '…' : stats.channelCount}
          </h2>
          <p className="text-gray-400">Total Channels</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-red-500 mb-1">
            {stats.loading ? '…' : stats.programCount}
          </h2>
          <p className="text-gray-400">Total Programs</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-red-500 mb-1">
            {stats.loading ? '…' : stats.activeChannelCount}
          </h2>
          <p className="text-gray-400">Active Channels</p>
        </div>
      </div>

      {stats.error && (
        <div className="mb-6 rounded-lg border border-red-800 bg-red-900/20 p-3 text-red-300">
          {stats.error}
        </div>
      )}

      {/* Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminLinks.map((section, i) => (
          <div key={i} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mr-4">{section.icon}</div>
                <h2 className="text-xl font-bold">{section.title}</h2>
              </div>
              <p className="text-gray-400 mb-6">{section.description}</p>
              <div className="space-y-2">
                {section.links.map((link, j) => (
                  <Link key={j} href={link.href} className="block">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left bg-gray-700 hover:bg-gray-600 border-gray-600"
                    >
                      {link.icon}
                      <span className="ml-2">{link.name}</span>
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Extra cards */}
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
            <Link href="/admin/reset-programs" className="w-full">
              <Button className="w-full bg-red-600 hover:bg-red-700">Reset Programs</Button>
            </Link>
          </CardFooter>
        </Card>

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
              <Button className="w-full bg-blue-600 hover:bg-blue-700">Open SQL Tool</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Clear cache tile */}
      <Link href="/admin/clear-cache">
        <div className="mt-8 bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Clear Cache</h3>
            <Trash2 className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-gray-300 mb-2">
            Clear browser cache and local storage to fix issues with data not updating properly.
          </p>
          <div className="text-sm text-gray-400">Use when news items or other data isn't refreshing</div>
        </div>
      </Link>
    </div>
  );
}
