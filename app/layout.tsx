import type { Metadata } from "next";
import "./globals.css";

// If your nav file is named differently, keep your existing nav import:
import { Navbar } from "@/components/navbar";

import NewsTickerLive from "@/components/news-ticker-live";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <Navbar />
        {/* Ticker right under the fixed navbar */}
        <NewsTickerLive />
        {/* Push content down so it’s not hidden behind fixed navbar */}
        <main className="pt-[72px]">
          {children}
        </main>
      </body>
    </html>
  );
}
