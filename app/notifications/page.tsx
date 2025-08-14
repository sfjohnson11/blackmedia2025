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
  const s = Math.max(0, ((Date.now() - new Date(iso).getTime()) / 1000) | 0);
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
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userIdRef = useRef<string | null>(null);
  const isInitRef = useRef(false);

  async function loadPage(reset = false) {
    setError(null);
    setLoading(true);
    try {
      let query = supabase
        .from("user_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (!reset && list.length > 0) {
        const last = list[list.length - 1];
        if (last) query = query.lt("created_at", last.created_at);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as NotificationRow[];
      if (reset) {
        setList(rows);
      } else {
        setList((curr) => [...curr, ...rows]);
      }
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  // Initial auth + realtime
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        router.replace(`/auth/login?redirect_to=/notifications`);
        return;
      }
      userIdRef.current = user.id;

      // First page
      await loadPage(true);

      // Realtime scoped to this user (extra filter for efficiency)
      const channel = supabase
        .channel("realtime:user_notifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setList((curr) => [payload.new as NotificationRow, ...curr]);
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

      isInitRef.current = true;
      return () => {
        supabase.removeChannel(channel);
      };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markRead(id: string) {
    setBusyIds((b) => ({ ...b, [id]: true }));
    setError(null);
    try {
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Optimistic UI
      setList((curr) => curr.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    } catch (e: any) {
      setError(e?.message || "Failed to mark as read.");
    } finally {
      setBusyIds((b) => ({ ...b, [id]: false }));
    }
  }

  // ✅ Fixed: use a server-side RPC that touches ONLY the current user's rows
  async function markAllRead() {
    setBulkBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("mark_all_notifications_read");
      if (error) throw error;

      // Update all unread rows locally
      setList((curr) =>
        curr.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
      );
    } catch (e: any) {
      setError(e?.message || "Failed to mark all as read.");
    } finally {
      setBulkBusy(false);
    }
  }

  // ✅ Fixed: use RPC to clear ONLY current user's rows
  async function clearAll() {
    setBulkBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("clear_all_notifications");
      if (error) throw error;

      setList([]);
      setHasMore(false);
    } catch (e: any) {
      setError(e?.message || "Failed to clear notifications.");
    } finally {
      setBulkBusy(false);
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
              disabled={bulkBusy || unreadCount === 0}
              onClick={markAllRead}
              className="bg-gray-700 hover:bg-gray-600 text-white"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
            <Button
              size="sm"
              disabled={bulkBusy || list.length === 0}
              onClick={clearAll}
              className="bg-gray-700 hover:bg-gray-600 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear all
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded border border-red-700 bg-red-900/30 text-red-200">
            {error}
          </div>
        )}

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
                  {!n.read_at && (
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
                    onClick={() => {
                      // small local-UX optimization
                      setBusyIds((b) => ({ ...b, [n.id]: true }));
                      supabase
                        .from("user_notifications")
                        .delete()
                        .eq("id", n.id)
                        .then(({ error }) => {
                          if (error) throw error;
                          setList((curr) => curr.filter((x) => x.id !== n.id));
                        })
                        .catch((e) => setError(e?.message || "Failed to delete."))
                        .finally(() => setBusyIds((b) => ({ ...b, [n.id]: false })));
                    }}
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
