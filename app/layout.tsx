// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { BreakingNews } from "@/components/breaking-news";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming channels and live programming",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        {/* Fixed navbar (from your components/navbar.tsx) */}
        <Navbar />

        {/* Scrolls under the fixed navbar, shows only if there are news items */}
        <BreakingNews />

        {/* Page content */}
        <main>{children}</main>
      </body>
    </html>
  );
}
