// app/app/page.tsx
export default function AppPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#fff",
        padding: "32px",
      }}
    >
      <h1 style={{ fontSize: "28px", marginBottom: "16px" }}>
        Black Truth TV — Member Hub
      </h1>
      <p>Welcome to the member app homepage.</p>
      <p style={{ marginTop: "8px", fontSize: "14px", opacity: 0.8 }}>
        From here you&apos;ll be able to jump to live channels, Freedom School, and
        On-Demand once we wire them up.
      </p>
    </div>
  );
}
