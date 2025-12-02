"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type ChatRoom = {
  id: string;
  name: string;
  description: string | null;
};

type ChatMessage = {
  id: string;
  message: string;
  created_at: string;
  sender_id: string;
  sender_name: string | null;
};

export default function ChatRoomPage() {
  const supabase = createClientComponentClient();
  const params = useParams();
  const roomId = params?.roomId as string;

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  function scrollToBottom() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load room + initial messages
  useEffect(() => {
    if (!roomId) return;

    async function loadInitial() {
      setLoading(true);
      setErrorMsg(null);

      // Load room info
      const { data: roomData, error: roomError } = await supabase
        .from("chat_rooms")
        .select("id, name, description")
        .eq("id", roomId)
        .single();

      if (roomError || !roomData) {
        console.error("Error loading room:", roomError);
        setErrorMsg("Could not load this chat room.");
        setLoading(false);
        return;
      }

      setRoom(roomData as ChatRoom);

      // Load messages with sender name
      const { data: msgData, error: msgError } = await supabase
        .from("chat_messages")
        .select(
          `
          id,
          message,
          created_at,
          sender_id,
          sender:sender_id ( name )
        `
        )
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (msgError) {
        console.error("Error loading messages:", msgError);
        setErrorMsg("Could not load chat messages.");
      } else {
        const mapped =
          (msgData || []).map((row: any) => ({
            id: row.id,
            message: row.message,
            created_at: row.created_at,
            sender_id: row.sender_id,
            sender_name: row.sender?.name ?? null,
          })) ?? [];
        setMessages(mapped);
      }

      setLoading(false);
    }

    loadInitial();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Subscribe to realtime new messages
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`chat-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const row: any = payload.new;

          // Get sender name (small extra query) or just show "Member"
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("name")
            .eq("id", row.sender_id)
            .single();

          setMessages((prev) => [
            ...prev,
            {
              id: row.id,
              message: row.message,
              created_at: row.created_at,
              sender_id: row.sender_id,
              sender_name: profile?.name ?? null,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !roomId) return;

    setSending(true);
    setErrorMsg(null);

    const { error } = await supabase.from("chat_messages").insert({
      room_id: roomId,
      message: newMessage.trim(),
      // sender_id is filled by client or default RLS; if needed,
      // you can add a trigger to set sender_id = auth.uid()
    });

    if (error) {
      console.error("Error sending message:", error);
      setErrorMsg("Could not send your message. Please try again.");
    } else {
      setNewMessage("");
      // We rely on realtime subscription to append the new message.
    }

    setSending(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #020617 0, #020617 40%, #000 100%)",
        color: "#f9fafb",
        padding: "18px 12px 24px",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 950,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 40px)",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <div>
            <Link
              href="/chat"
              style={{
                fontSize: 11,
                color: "rgba(148,163,184,0.9)",
                textDecoration: "none",
              }}
            >
              ← All Rooms
            </Link>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                margin: "4px 0 2px",
              }}
            >
              {room ? room.name : "Chat Room"}
            </h1>
            {room?.description && (
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(148,163,184,0.9)",
                  margin: 0,
                }}
              >
                {room.description}
              </p>
            )}
          </div>

          <Link
            href="/app"
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.7)",
              textDecoration: "none",
              color: "rgba(241,245,249,0.96)",
              background:
                "linear-gradient(90deg, rgba(15,23,42,0.96), rgba(30,64,175,0.85))",
            }}
          >
            Member Hub →
          </Link>
        </header>

        {errorMsg && (
          <div
            style={{
              marginBottom: 10,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(248,113,113,0.65)",
              background: "rgba(127,29,29,0.32)",
              fontSize: 12,
              color: "#fee2e2",
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Chat area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: 16,
            border: "1px solid rgba(30,64,175,0.7)",
            background:
              "radial-gradient(circle at top left, rgba(30,64,175,0.45), #020617 55%)",
            overflow: "hidden",
          }}
        >
          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: "12px 12px 8px",
              overflowY: "auto",
              fontSize: 13,
            }}
          >
            {loading ? (
              <div
                style={{
                  textAlign: "center",
                  marginTop: 40,
                  color: "rgba(148,163,184,0.9)",
                }}
              >
                Loading messages…
              </div>
            ) : messages.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  marginTop: 40,
                  color: "rgba(148,163,184,0.9)",
                }}
              >
                No messages yet. Say hello and start the conversation.
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: 8,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(148,163,184,0.9)",
                        marginBottom: 2,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {msg.sender_name || "Member"}
                      </span>{" "}
                      <span style={{ opacity: 0.8 }}>
                        ·{" "}
                        {new Date(msg.created_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        background:
                          "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,64,175,0.9))",
                        border: "1px solid rgba(30,64,175,0.9)",
                        maxWidth: "80%",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.message}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            style={{
              borderTop: "1px solid rgba(30,64,175,0.85)",
              padding: "10px 10px 9px",
              background:
                "linear-gradient(to right, rgba(15,23,42,0.96), rgba(15,23,42,0.94))",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message…"
              style={{
                flex: 1,
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.8)",
                background: "rgba(15,23,42,0.96)",
                color: "#f9fafb",
                fontSize: 13,
                padding: "8px 12px",
              }}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              style={{
                borderRadius: 999,
                padding: "8px 14px",
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor:
                  sending || !newMessage.trim() ? "not-allowed" : "pointer",
                opacity: sending || !newMessage.trim() ? 0.7 : 1,
             	background:
                "linear-gradient(135deg, #FFD700 0%, #fbbf24 35%, #f97316 80%)",
                color: "#111827",
                boxShadow: "0 8px 20px rgba(180,83,9,0.55)",
              }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
