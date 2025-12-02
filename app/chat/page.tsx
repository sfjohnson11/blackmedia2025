"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type ChatRoom = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export default function ChatRoomsPage() {
  const supabase = createClientComponentClient();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadRooms() {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("chat_rooms")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading chat rooms:", error);
      setErrorMsg("Could not load chat rooms. Please try again.");
    } else {
      setRooms((data || []) as ChatRoom[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #020617 0, #020617 40%, #000 100%)",
        color: "#f9fafb",
        padding: "24px 16px 40px",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Black Truth TV Community Chat
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "rgba(209,213,219,0.85)",
                maxWidth: 520,
              }}
            >
              Private, curated spaces for approved members of the Black Truth TV
              community to discuss programming, Freedom School, and more.
            </p>
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
            ← Back to Member Hub
          </Link>
        </header>

        {/* Info strip */}
        <div
          style={{
            marginBottom: 18,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(250,204,21,0.35)",
            background:
              "linear-gradient(90deg, rgba(250,204,21,0.14), rgba(15,23,42,0.96))",
            fontSize: 12,
            color: "rgba(254,252,232,0.96)",
          }}
        >
          <strong>Private Community Notice:</strong> Chat access is limited to
          approved Black Truth TV members. Messages are moderated and may be
          removed if they don&apos;t align with our mission and community
          standards.
        </div>

        {errorMsg && (
          <div
            style={{
              marginBottom: 14,
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

        {loading ? (
          <div
            style={{
              padding: "32px 0",
              textAlign: "center",
              fontSize: 13,
              color: "rgba(148,163,184,0.9)",
            }}
          >
            Loading rooms…
          </div>
        ) : rooms.length === 0 ? (
          <div
            style={{
              padding: "32px 0",
              textAlign: "center",
              fontSize: 13,
              color: "rgba(148,163,184,0.9)",
            }}
          >
            No chat rooms have been set up yet. An admin can create rooms in the
            database.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/chat/${room.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    borderRadius: 16,
                    padding: "14px 15px",
                    background:
                      "radial-gradient(circle at top left, rgba(56,189,248,0.22), transparent 55%) #020617",
                    border: "1px solid rgba(148,163,184,0.4)",
                    boxShadow:
                      "0 12px 30px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.95)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 120,
                    transition:
                      "transform 0.16s ease-out, box-shadow 0.16s ease-out, border-color 0.16s ease-out",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = "translateY(-3px)";
                    el.style.boxShadow =
                      "0 18px 40px rgba(15,23,42,1), 0 0 0 1px rgba(30,64,175,0.9)";
                    el.style.borderColor = "rgba(250,204,21,0.85)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = "translateY(0)";
                    el.style.boxShadow =
                      "0 12px 30px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.95)";
                    el.style.borderColor = "rgba(148,163,184,0.4)";
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "rgba(148,163,184,0.9)",
                        marginBottom: 4,
                      }}
                    >
                      Community Room
                    </div>
                    <h2
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        margin: 0,
                        marginBottom: 4,
                        color: "#f9fafb",
                      }}
                    >
                      {room.name}
                    </h2>
                    {room.description && (
                      <p
                        style={{
                          fontSize: 13,
                          color: "rgba(209,213,219,0.9)",
                          margin: 0,
                        }}
                      >
                        {room.description}
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 11,
                      color: "rgba(209,213,219,0.86)",
                    }}
                  >
                    <span
                      style={{
                        padding: "4px 9px",
                        borderRadius: 999,
                        background:
                          "linear-gradient(90deg, rgba(250,204,21,0.18), rgba(234,179,8,0.32))",
                        color: "#fef9c3",
                        fontWeight: 600,
                      }}
                    >
                      Enter chat →
                    </span>
                    <span style={{ opacity: 0.7 }}>Members only</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
