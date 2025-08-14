import type { Metadata } from "next";
import "./globals.css";

// your existing navbar export
import { Navbar } from "@/components/navbar";

// ⬇️ add this
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
        <NewsTickerLive />
        {/* Increase padding-top so content clears navbar + ticker (approx 112px) */}
        <main className="pt-[112px]">
          {children}
        </main>
      </body>
    </html>
  );
}
