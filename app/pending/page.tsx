export default function PendingPage() {
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
        <h1 style={{ fontSize: 28, fontWeight: 900, textAlign: "center" }}>
          Access Pending
        </h1>

        <p style={{ marginTop: 12, opacity: 0.9, lineHeight: 1.6 }}>
          Your request is on file, but your account is not active yet.
          <br />
          Once approved, you’ll receive a private sign-in link.
        </p>

        <p style={{ marginTop: 12, opacity: 0.75, fontSize: 13 }}>
          If you think you should already have access, email{" "}
          <span style={{ color: "#facc15" }}>info@sfjohnsonconsulting.com</span>.
        </p>

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
