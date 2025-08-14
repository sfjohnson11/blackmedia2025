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
        <div id="global-news-ticker">
          <NewsTickerLive />
        </div>
        <main className="pt-28">{children}</main>
      </body>
    </html>
  );
}
