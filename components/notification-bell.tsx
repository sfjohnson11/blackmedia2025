// components/notification-bell.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function NotificationBell({ className = "" }: { className?: string }) {
  const [count, setCount] = useState<number>(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        setCount(0);
        setReady(true);
        return;
      }

      // Initial unread count (HEAD request with count only)
      {
        const { count, error } = await supabase
          .from("user_notifications")
          .select("*", { count: "exact", head: true })
          .is("read_at", null);
        if (!error && typeof count === "number") setCount(count);
      }

      // Realtime: scope to current user for efficiency
      const channel = supabase
        .channel("realtime:bell_badge")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            // Recompute on any insert/update/delete
            const { count } = await supabase
              .from("user_notifications")
              .select("*", { count: "exact", head: true })
              .is("read_at", null);
            setCount(count || 0);
          }
        )
        .subscribe();

      unsub = () => supabase.removeChannel(channel);
      setReady(true);
    })();

    return () => unsub();
  }, []);

  return (
    <Link
      href="/notifications"
      className={`relative inline-flex items-center justify-center p-2 rounded hover:bg-gray-800 ${className}`}
      aria-label="Notifications"
    >
      <Bell className="h-5 w-5" />
      {ready && count > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-red-600 text-[10px] leading-4 text-white text-center"
          aria-label={`${count} unread notifications`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
