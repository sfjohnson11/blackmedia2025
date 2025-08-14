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
        <Navbar />
        {/* Ticker sits below fixed navbar */}
        <NewsTickerLive />

        {/* If you previously added big padding here, you can reduce a bit now */}
        <main className="pt-4">{children}</main>
      </body>
    </html>
  );
}
