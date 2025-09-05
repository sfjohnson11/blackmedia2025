// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming live and on-demand.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <head>
        {/* Speed up first-byte from Supabase */}
        <link
          rel="preconnect"
          href="https://msllqpnxwbugvkpnquwx.supabase.co"
          crossOrigin=""
        />
        <link
          rel="dns-prefetch"
          href="https://msllqpnxwbugvkpnquwx.supabase.co"
        />
      </head>
      <body className="bg-black text-white">{children}</body>
    </html>
  );
}
