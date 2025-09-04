// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import SiteNavbar from "@/components/site-navbar";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming live and on-demand.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="bg-black text-white">
        <SiteNavbar />
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
