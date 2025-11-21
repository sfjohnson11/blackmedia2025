// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming live and on-demand Black history and culture.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* 🔒 Global lock: everything except /login goes through AuthGate */}
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
