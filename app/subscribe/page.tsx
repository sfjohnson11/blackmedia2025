"use client";

export default function SubscribePage() {
  const STRIPE_LINK = "https://buy.stripe.com/7sY8wPekWcUp6IM6Rq6J314";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #1f3b73 0, #050816 55%, #000 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "rgba(10,20,40,0.92)",
          borderRadius: 16,
          padding: "28px 24px",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 18px 45px rgba(0,0,0,0.65)",
        }}
      >
        <h1 style={{ fontSize: 30, fontWeight: 900, textAlign: "center" }}>
          Black Truth TV Membership
        </h1>

        <p style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.6 }}>
          Due to storage and streaming costs, Black Truth TV is moving to a paid
          membership model.
          <br />
          Starting <b>February 1, 2026</b>, access requires an active membership.
        </p>

        <div
          style={{
            marginTop: 16,
            padding: 18,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(2,6,23,0.55)",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 900, color: "#facc15" }}>
            $9.99 / month
          </div>

          <div style={{ marginTop: 6, opacity: 0.9 }}>
            Upgrade now to keep uninterrupted access.
          </div>

          <a
            href={STRIPE_LINK}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              marginTop: 14,
              width: "100%",
              textAlign: "center",
              padding: "12px 14px",
              borderRadius: 999,
              background:
                "linear-gradient(135deg, #FFD700 0%, #fbbf24 35%, #f97316 80%)",
              color: "#111827",
              fontWeight: 900,
              letterSpacing: 0.06,
              textTransform: "uppercase",
              textDecoration: "none",
              boxShadow: "0 10px 25px rgba(180,83,9,0.5)",
            }}
          >
            Upgrade Now
          </a>

          <p style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
            After upgrading, log out and log back in if access doesn’t refresh
            immediately.
          </p>
        </div>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <a
            href="/login"
            style={{ color: "#facc15", textDecoration: "underline" }}
          >
            Back to Login
          </a>
        </div>
      </div>
    </main>
  );
}
