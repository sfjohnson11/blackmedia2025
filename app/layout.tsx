// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import NewsTickerLive from "@/components/news-ticker-live";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming 24/7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Fixed navbar you already have */}
        <Navbar />

        {/* ONE ticker for the whole site (sits below the fixed navbar) */}
        <NewsTickerLive />

        {children}
      </body>
    </html>
  );
}
