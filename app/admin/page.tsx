"use client";

import Link from "next/link";

type Tool = {
  name: string;
  path: string;
  description: string;
};

const channelTools: Tool[] = [
  {
    name: "Channel Manager",
    path: "/admin/channel-manager",
    description: "Edit channel names, logos, and branding.",
  },
  {
    name: "Add Channel",
    path: "/admin/add-channel",
    description: "Create a brand new Black Truth TV channel.",
  },
  {
    name: "Channel Live",
    path: "/admin/channel-live",
    description: "Control live status and preview channel output.",
  },
  {
    name: "Categories",
    path: "/admin/categories",
    description: "Organize content into categories and themes.",
  },
];

const programmingTools: Tool[] = [
  {
    name: "Programs",
    path: "/admin/programs",
    description: "Manage all programs in the library.",
  },
  {
    name: "Program Titles",
    path: "/admin/program-titles",
    description: "Clean up and standardize program names.",
  },
  {
    name: "Schedule",
    path: "/admin/schedule",
    description: "Daily / weekly schedule overview.",
  },
  {
    name: "Scheduler",
    path: "/admin/scheduler",
    description: "Build and tweak channel lineups.",
  },
  {
    name: "Monday Schedule",
    path: "/admin/monday-schedule",
    description: "Reset and seed the Monday master schedule.",
  },
  {
    name: "Auto Schedule",
    path: "/admin/auto-schedule",
    description: "Auto-generate rotations from rules.",
  },
  {
    name: "Refresh Programs",
    path: "/admin/refresh-programs",
    description: "Reload metadata and sync playlists.",
  },
  {
    name: "Cleanup Programs",
    path: "/admin/cleanup-programs",
    description: "Remove duplicates and broken entries.",
  },
  {
    name: "Reset Programs",
    path: "/admin/reset-programs",
    description: "Hard reset of program schedules.",
  },
  {
    name: "News Manager",
    path: "/admin/news",
    description: "Control Black Truth TV news content and ticker.",
  },
  {
    name: "Breaking News Editor",
    path: "/admin/breaking-news",
    description:
      "Edit the three Breaking News segment cards shown on /breaking-news.",
  },
  {
    name: "Continue Watching",
    path: "/admin/continue",
    description: "Manage the continuing content flows.",
  },
];

const libraryTools: Tool[] = [
  {
    name: "Library Manager",
    path: "/admin/library-manager",
    description: "Administer the master media library.",
  },
  {
    name: "Freedom School Library",
    path: "/admin/freedom-school-library",
    description: "Upload and organize Freedom School content.",
  },
  {
    name: "On-Demand Library",
    path: "/on-demand",
    description: "Upload, edit, and manage On-Demand videos and collections.",
  },
];

const systemTools: Tool[] = [
  {
    name: "Database Inspector",
    path: "/admin/database-inspector",
    description: "Inspect database tables and debug data issues.",
  },
  {
    name: "Invite Codes",
    path: "/admin/invite-codes",
    description: "Create and manage invite codes for access.",
  },
  {
    name: "Membership Requests",
    path: "/admin/membership-requests",
    description: "Review and approve new member access requests.",
  },
];

function Section({
  title,
  subtitle,
  tools,
}: {
  title: string;
  subtitle: string;
  tools: Tool[];
}) {
  return (
    <section style={{ marginBottom: "32px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "baseline",
          marginBottom: "12px",
        }}
      >
        <h2 style={{ fontSize: "20px", fontWeight: 600 }}>{title}</h2>
        <p
          style={{
            fontSize: "13px",
            opacity: 0.7,
            maxWidth: "420px",
            textAlign: "right",
          }}
        >
          {subtitle}
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: "16px",
        }}
      >
        {tools.map((tool) => (
          <ToolCard key={tool.path} tool={tool} />
        ))}
      </div>
    </section>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link href={tool.path} style={{ textDecoration: "none" }}>
      <div
        style={{
          background:
            "radial-gradient(circle at top left, rgba(56,189,248,0.22), transparent 55%) #020617",
          borderRadius: "16px",
          border: "1px solid rgba(148,163,184,0.35)",
          padding: "16px 18px",
          minHeight: "110px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow:
            "0 12px 30px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.9)",
          transition:
            "transform 0.16s ease-out, box-shadow 0.16s ease-out, border-color 0.16s ease-out, background 0.16s ease-out",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform =
            "translateY(-4px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 18px 40px rgba(15,23,42,1)";
          (e.currentTarget as HTMLDivElement).style.borderColor =
            "rgba(250,204,21,0.85)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 12px 30px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.9)";
          (e.currentTarget as HTMLDivElement).style.borderColor =
            "rgba(148,163,184,0.35)";
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(248,250,252,0.75)",
              marginBottom: "4px",
            }}
          >
            Tool
          </div>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              margin: 0,
              marginBottom: "6px",
              color: "#f9fafb",
            }}
          >
            {tool.name}
          </h3>
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.4,
              color: "rgba(209,213,219,0.85)",
              margin: 0,
            }}
          >
            {tool.description}
          </p>
        </div>
        <div
          style={{
            marginTop: "10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "12px",
            color: "rgba(249,250,251,0.8)",
          }}
        >
          <span
            style={{
              padding: "4px 9px",
              borderRadius: "999px",
              background:
                "linear-gradient(90deg, rgba(250,204,21,0.18), rgba(234,179,8,0.32))",
              color: "#fef9c3",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            Open tool →
          </span>
          <span style={{ opacity: 0.65 }}>Admin • Black Truth TV</span>
        </div>
      </div>
    </Link>
  );
}

function QuickLink({
  label,
  path,
  detail,
}: {
  label: string;
  path: string;
  detail: string;
}) {
  return (
    <Link href={path} style={{ textDecoration: "none" }}>
      <div
        style={{
          borderRadius: "999px",
          padding: "7px 12px",
          border: "1px solid rgba(148,163,184,0.7)",
          background:
            "linear-gradient(90deg, rgba(15,23,42,0.96), rgba(30,64,175,0.8))",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          fontSize: "12px",
          color: "rgba(241,245,249,0.98)",
          transition:
            "transform 0.16s ease-out, border-color 0.16s ease-out, background 0.16s ease-out",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform =
            "translateY(-2px)";
          (e.currentTarget as HTMLDivElement).style.borderColor =
            "rgba(250,204,21,0.9)";
          (e.currentTarget as HTMLDivElement).style.background =
            "linear-gradient(90deg, rgba(30,64,175,0.9), rgba(250,204,21,0.8))";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLDivElement).style.borderColor =
            "rgba(148,163,184,0.7)";
          (e.currentTarget as HTMLDivElement).style.background =
            "linear-gradient(90deg, rgba(15,23,42,0.96), rgba(30,64,175,0.8))";
        }}
      >
        <div>
          <div style={{ fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: "11px", opacity: 0.8 }}>{detail}</div>
        </div>
        <span style={{ fontSize: "16px", lineHeight: 1 }}>→</span>
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #0b1120 0, #020617 45%, #000000 100%)",
        color: "white",
      }}
    >
      <header
        style={{
          padding: "20px 40px 10px",
          borderBottom: "1px solid rgba(30,64,175,0.5)",
          backdropFilter: "blur(18px)",
          position: "sticky",
          top: 0,
          zIndex: 20,
          background:
            "linear-gradient(to bottom, rgba(15,23,42,0.96), rgba(15,23,42,0.9), transparent)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "999px",
                background:
                  "radial-gradient(circle at 30% 0, #facc15, #eab308 36%, #111827 80%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: 800,
                color: "#020617",
                boxShadow:
                  "0 0 0 2px #0f172a, 0 10px 25px rgba(15,23,42,0.95)",
              }}
            >
              B
            </div>
            <div>
              <div
                style={{
                  fontSize: "13px",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(148,163,184,0.9)",
                }}
              >
                Black Truth TV
              </div>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>
                Admin Control Center
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              fontSize: "12px",
            }}
          >
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "999px",
                border: "1px solid rgba(148,163,184,0.6)",
                color: "rgba(209,213,219,0.9)",
              }}
            >
              Role: <strong style={{ color: "#facc15" }}>Admin</strong>
            </span>

            <span
              style={{
                padding: "4px 10px",
                borderRadius: "999px",
                background:
                  "linear-gradient(90deg, rgba(56,189,248,0.15), rgba(129,140,248,0.3))",
                color: "rgba(241,245,249,0.95)",
              }}
            >
              Network Status: Online
            </span>
          </div>
        </div>
      </header>

      <main
        style={{
          padding: "28px 40px 40px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2.1fr) minmax(0, 1.4fr)",
            gap: "24px",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "30px",
                marginBottom: "10px",
                lineHeight: 1.15,
              }}
            >
              Welcome back to{" "}
              <span style={{ color: "#facc15" }}>Black Truth TV Admin</span>
            </h1>

            <p
              style={{
                fontSize: "14px",
                color: "rgba(209,213,219,0.9)",
                maxWidth: "560px",
              }}
            >
              Manage channels, schedules, Freedom School, and the full Black
              Truth TV network from one control center. Choose a tool below to
              update content, clean playlists, or reset programming.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginTop: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  padding: "5px 10px",
                  borderRadius: "999px",
                  background: "rgba(30,64,175,0.65)",
                  border: "1px solid rgba(129,140,248,0.6)",
                }}
              >
                TV Network • 24/7 Rotation
              </span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "5px 10px",
                  borderRadius: "999px",
                  background: "rgba(22,101,52,0.6)",
                  border: "1px solid rgba(74,222,128,0.7)",
                }}
              >
                Freedom School • Education
              </span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "5px 10px",
                  borderRadius: "999px",
                  background: "rgba(120,53,15,0.75)",
                  border: "1px solid rgba(251,191,36,0.7)",
                }}
              >
                Admin • Power Tools
              </span>
            </div>
          </div>

          <div>
            <div
              style={{
                borderRadius: "18px",
                padding: "16px 18px",
                background:
                  "radial-gradient(circle at top, rgba(250,204,21,0.16), rgba(15,23,42,0.95))",
                border: "1px solid rgba(148,163,184,0.6)",
                boxShadow: "0 14px 35px rgba(15,23,42,0.95)",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "rgba(249,250,251,0.9)",
                  marginBottom: "6px",
                }}
              >
                Quick Access
              </div>

              <p
                style={{
                  fontSize: "13px",
                  color: "rgba(226,232,240,0.95)",
                  marginBottom: "10px",
                }}
              >
                Most-used tools for weekly operations:
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: "8px",
                }}
              >
                <QuickLink
                  label="Manage Programs"
                  path="/admin/programs"
                  detail="Review and update program entries."
                />
                <QuickLink
                  label="Monday Schedule"
                  path="/admin/monday-schedule"
                  detail="Run or review the weekly reset."
                />
                <QuickLink
                  label="Freedom School Library"
                  path="/admin/freedom-school-library"
                  detail="Curate and upload study content."
                />
                <QuickLink
                  label="Breaking News Editor"
                  path="/admin/breaking-news"
                  detail="Update tonight’s lead story and segment cards."
                />
                <QuickLink
                  label="Membership Requests"
                  path="/admin/membership-requests"
                  detail="Review and approve new member access."
                />
              </div>
            </div>
          </div>
        </div>

        <Section
          title="Channel Tools"
          subtitle="Set up and manage channels, names, branding, and live controls."
          tools={channelTools}
        />

        <Section
          title="Programming & Scheduling"
          subtitle="Control your 24/7 rotation, auto-scheduling, cleanup tools, and news."
          tools={programmingTools}
        />

        <Section
          title="Library & Freedom School"
          subtitle="Update your long-term archive and educational content for the network."
          tools={libraryTools}
        />

        <Section
          title="System & Utilities"
          subtitle="Back-end utilities for invites, database inspection, and member access."
          tools={systemTools}
        />
      </main>
    </div>
  );
}
