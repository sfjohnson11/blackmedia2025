// app/admin/page.tsx
"use client";

import Link from "next/link";

export default function AdminDashboard() {
  const tools = [
    { name: "Add Channel", path: "/admin/add-channel" },
    { name: "Auto Schedule", path: "/admin/auto-schedule" },
    { name: "Categories", path: "/admin/categories" },
    { name: "Channel Live", path: "/admin/channel-live" },
    { name: "Channel Manager", path: "/admin/channel-manager" },
    { name: "Cleanup Programs", path: "/admin/cleanup-programs" },
    { name: "Continue Watching", path: "/admin/continue" },
    { name: "Database Inspector", path: "/admin/database-inspector" },
    { name: "Freedom School Library", path: "/admin/freedom-school-library" },
    { name: "Invite Codes", path: "/admin/invite-codes" },
    { name: "Library Manager", path: "/admin/library-manager" },
    { name: "Monday Schedule", path: "/admin/monday-schedule" },
    { name: "News Manager", path: "/admin/news" },
    { name: "Program Titles", path: "/admin/program-titles" },
    { name: "Programs", path: "/admin/programs" },
    { name: "Refresh Programs", path: "/admin/refresh-programs" },
    { name: "Reset Programs", path: "/admin/reset-programs" },
    { name: "Schedule", path: "/admin/schedule" },
    { name: "Scheduler", path: "/admin/scheduler" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "white",
        padding: "40px",
      }}
    >
      <h1 style={{ fontSize: "32px", marginBottom: "20px" }}>
        Black Truth TV — Admin Dashboard
      </h1>

      <p style={{ marginBottom: "20px", opacity: 0.8 }}>
        Select a tool to continue:
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "20px",
        }}
      >
        {tools.map((tool) => (
          <Link
            key={tool.path}
            href={tool.path}
            style={{
              padding: "20px",
              background: "#0f172a",
              borderRadius: "12px",
              border: "1px solid #475569",
              textDecoration: "none",
              color: "white",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            {tool.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
