import "./globals.css";
import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import NewsTickerLive from "@/components/news-ticker-live";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="sticky z-40" style={{ top: "64px" }}>
          <NewsTickerLive />
        </div>
        <main className="pt-24">{children}</main>
      </body>
    </html>
  );
}
