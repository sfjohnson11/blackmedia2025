// app/chat/[roomId]/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type ChatRoom = {
  id: string;
  name: string;
  description: string | null;
  channel_id: string | null;
};

type ChatMessage = {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // adjust/remove this if your table doesn't have it
  author_name?: string | null;
};

export default function ChatRoomPage({
  params,
}: {
  params: { roomId: string };
}) {
  const supabase = createClientComponentClient();
  const roomId = params.roomId;

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Load room info
  useEffect(() => {
    async function loadRoom() {
      setLoadingRoom(true);
      setRoomError(null);

      const { data, error } = await supabase
        .from("chat_rooms")
        .select("id, name, description, channel_id")
        .eq("id", roomId)
        .single();

      if (error) {
        console.error("Error loading chat room:", error);
        setRoomError(error.message || "Could not load chat room.");
        setRoom(null);
      } else {
        setRoom(data as ChatRoom);
      }

      setLoadingRoom(false);
    }

    if (roomId) {
      loadRoom();
    }
  }, [roomId, supabase]);

  // Load messages
  useEffect(() => {
    async function loadMessages() {
      setLoadingMessages(true);
      setMessagesError(null);

      const { data, error } = await supabase
        .from("chat_messages")
        // adjust selected columns to match your schema
        .select("id, room_id, user_id, content, created_at, author_name")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading chat messages:", error);
        setMessagesError(
          error.message || "Could not load chat messages. Please try again."
        );
        setMessages([]);
      } else {
        setMessages((data || []) as ChatMessage[]);
      }

      setLoadingMessages(false);
    }

    if (roomId) {
      loadMessages();
    }
  }, [roomId, supabase]);

  // Send a new message
  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);

    try {
      // get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to send messages.");
        setSending(false);
        return;
      }

      const payload: any = {
        room_id: roomId,
        user_id: user.id,
        content: newMessage.trim(),
      };

      // If your table has author_name, you can pull from a profile table instead.
      // For now we'll leave it null and just show content.
      // payload.author_name = null;

      const { data, error } = await supabase
        .from("chat_messages")
        .insert(payload)
        .select("id, room_id, user_id, content, created_at, author_name")
        .single();

      if (error) {
        console.error("Error sending message:", error);
        alert(error.message || "Could not send message.");
      } else if (data) {
        setMessages((prev) => [...prev, data as ChatMessage]);
        setNewMessage("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <main className="max-w-4xl mx-auto px-4 pt-8 pb-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Black Truth TV • Community Chat
            </p>
            {loadingRoom ? (
              <h1 className="text-xl font-semibold text-slate-100">
                Loading room…
              </h1>
            ) : roomError ? (
              <h1 className="text-xl font-semibold text-red-300">
                {roomError}
              </h1>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-slate-50">
                  {room?.name || "Chat Room"}
                </h1>
                {room?.description && (
                  <p className="text-sm text-slate-300 mt-1">
                    {room.description}
                  </p>
                )}
              </>
            )}
          </div>

          <Link
            href="/app"
            className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 transition"
          >
            ← Back to Member Hub
          </Link>
        </div>

        {/* Chat panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 shadow-xl flex flex-col h-[70vh]">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messagesError ? (
              // REAL error
              <div className="text-sm text-red-300 bg-red-900/40 border border-red-500/60 rounded-md px-3 py-2">
                {messagesError}
              </div>
            ) : loadingMessages ? (
              // Loading state
              <div className="text-sm text-slate-300">
                Loading messages…
              </div>
            ) : messages.length === 0 ? (
              // ✅ EMPTY STATE – no messages, no error
              <div className="text-sm text-slate-200 bg-slate-900/60 border border-slate-700 rounded-md px-4 py-3">
                <p className="font-semibold text-slate-50 mb-1">
                  No messages yet.
                </p>
                <p className="text-xs text-slate-400">
                  Be the first to add a comment and start the conversation in
                  this Black Truth TV room.
                </p>
              </div>
            ) : (
              // Messages list
              <ul className="space-y-2">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg bg-slate-900/70 border border-slate-800 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-amber-300">
                        {m.author_name || "Member"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-100 whitespace-pre-wrap">
                      {m.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Message input */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-slate-800 bg-slate-950/90 px-4 py-3 flex gap-2"
          >
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={1}
              placeholder="Type your message…"
              className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="self-end rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-black shadow hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
