import "./globals.css";
import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { NewsTickerLive } from "@/components/news-ticker-live";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        {/* Fixed top nav */}
        <Navbar />

        {/* Single, global ticker just below the navbar */}
        <div id="global-news-ticker">
          <NewsTickerLive />
        </div>

        {/* Push content below the fixed header + ticker height */}
        <main className="pt-28">
          {children}
        </main>
      </body>
    </html>
  );
}
