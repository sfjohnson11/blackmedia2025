export default function SubscribePage() {
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
            $90.99 / month
          </div>
          <div style={{ marginTop: 6, opacity: 0.9 }}>
            Upgrade to keep access.
          </div>

          <button
            disabled
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 14px",
              borderRadius: 999,
              border: "none",
              background:
                "linear-gradient(135deg, #FFD700 0%, #fbbf24 35%, #f97316 80%)",
              color: "#111827",
              fontWeight: 900,
              letterSpacing: 0.06,
              textTransform: "uppercase",
              opacity: 0.65,
              cursor: "not-allowed",
            }}
          >
            Upgrade (Stripe setup next)
          </button>

          <p style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
            You’ll be able to upgrade here once Stripe is connected.
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
