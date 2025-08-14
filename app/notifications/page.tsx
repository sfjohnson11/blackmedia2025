// app/notifications/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  channel_id: string | null;
  created_at: string; // ISO
  read_at: string | null;
};

const PAGE_SIZE = 20;

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000 | 0);
  if (s < 60) return `${s | 0}s ago`;
  const m = (s / 60) | 0;
  if (m < 60) return `${m}m ago`;
  const h = (m / 60) | 0;
  if (h < 24) return `${h}h ago`;
  const d = (h / 24) | 0;
  return `${d}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<NotificationRow[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [clearing, setClearing] = useState(false);

  const sessionRef = useRef<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] | null>(null);
  const newestSeenRef = useRef<string | null>(null); // first page newest id

  // Ensure user is logged in; otherwise redirect to login with return path
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      sessionRef.current = data.session;
      if (!data.session?.user) {
        router.replace(`/auth/login?redirect_to=/notifications`);
        return;
      }
      // initial load
      void loadPage(true);
      // realtime channel (RLS will scope to this user)
      const channel = supabase
        .channel("realtime:user_notifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as NotificationRow;
              // Put newest on top
              setList((curr) => [row, ...curr]);
            } else if (payload.eventType === "UPDATE") {
              const row = payload.new as NotificationRow;
              setList((curr) => curr.map((n) => (n.id === row.id ? row : n)));
            } else if (payload.eventType === "DELETE") {
              const row = payload.old as NotificationRow;
              setList((curr) => curr.filter((n) => n.id !== row.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPage(reset = false) {
    setLoading(true);
    try {
      let query = supabase
        .from("user_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (!reset && list.length > 0) {
        const last = list[list.length - 1];
        if (last) {
          query = query.lt("created_at", last.created_at);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as NotificationRow[];
      if (reset) {
        setList(rows);
        newestSeenRef.current = rows[0]?.id ?? null;
      } else {
        setList((curr) => [...curr, ...rows]);
      }
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e: any) {
      console.error("loadPage error:", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    setBusyIds((b) => ({ ...b, [id]: true }));
    try {
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setList((curr) => curr.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    } catch (e: any) {
      console.error("markRead error:", e.message);
    } finally {
      setBusyIds((b) => ({ ...b, [id]: false }));
    }
  }

  async function deleteOne(id: string) {
    setBusyIds((b) => ({ ...b, [id]: true }));
    try {
      const { error } = await supabase.from("user_notifications").delete().eq("id", id);
      if (error) throw error;
      setList((curr) => curr.filter((n) => n.id !== id));
    } catch (e: any) {
      console.error("deleteOne error:", e.message);
    } finally {
      setBusyIds((b) => ({ ...b, [id]: false }));
    }
  }

  async function markAllRead() {
    setClearing(true);
    try {
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
      setList((curr) => curr.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    } catch (e: any) {
      console.error("markAllRead error:", e.message);
    } finally {
      setClearing(false);
    }
  }

  async function clearAll() {
    setClearing(true);
    try {
      const { error } = await supabase.from("user_notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      setList([]);
      setHasMore(false);
    } catch (e: any) {
      console.error("clearAll error:", e.message);
    } finally {
      setClearing(false);
    }
  }

  const unreadCount = useMemo(() => list.filter((n) => !n.read_at).length, [list]);

  return (
    <div className="pt-24 px-4 md:px-10 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Link href="/" className="mr-4">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <span className="ml-3 text-sm text-gray-400">({unreadCount} unread)</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={clearing || unreadCount === 0}
              onClick={markAllRead}
              className="bg-gray-700 hover:bg-gray-600 text-white"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
            <Button
              size="sm"
              disabled={clearing || list.length === 0}
              onClick={clearAll}
              className="bg-gray-700 hover:bg-gray-600 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear all
            </Button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden divide-y divide-gray-700">
          {list.length === 0 && !loading && (
            <div className="p-6 text-center text-gray-400">No notifications yet</div>
          )}

          {list.map((n) => {
            const isUnread = !n.read_at;
            return (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between ${isUnread ? "bg-gray-800" : "bg-gray-900/40"}`}
              >
                <div className="flex items-start">
                  <Bell className={`h-5 w-5 mr-3 ${isUnread ? "text-red-500" : "text-gray-500"}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium ${isUnread ? "" : "text-gray-300"}`}>{n.title}</h3>
                      <span className="text-xs text-gray-500">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.body && <p className="text-sm text-gray-400 mt-1">{n.body}</p>}
                    {n.link && (
                      <Link href={n.link} className="text-sm text-red-400 hover:underline mt-1 inline-block">
                        View
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isUnread && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-gray-700 hover:bg-gray-600 text-white"
                      disabled={busyIds[n.id]}
                      onClick={() => markRead(n.id)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Mark read
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-gray-700 hover:bg-gray-600 text-white"
                    disabled={busyIds[n.id]}
                    onClick={() => deleteOne(n.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="p-4 text-center">
              <Button
                onClick={() => loadPage(false)}
                disabled={loading}
                className="bg-gray-700 hover:bg-gray-600 text-white"
              >
                {loading ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}

          {loading && list.length === 0 && (
            <div className="p-6 text-center text-gray-400">Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
