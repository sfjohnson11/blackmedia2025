// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

// ✅ your navbar
import { Navbar } from "@/components/navbar";

// ✅ live ticker wrapper we added earlier
import NewsTickerLive from "@/components/news-ticker-live";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white">
        {/* Fixed navbar (from your code) */}
        <Navbar />

        {/* Stick the ticker BELOW the fixed navbar */}
        {/* If your navbar is ~64px tall, top-[64px] keeps them from overlapping. */}
        {/* Tweak 56/64/72px if your header height differs. */}
        <div className="sticky z-40" style={{ top: "64px" }}>
          <NewsTickerLive />
        </div>

        {/* Add top padding so page content isn't hidden behind the fixed navbar */}
        <main className="pt-24">{children}</main>
      </body>
    </html>
  );
}
