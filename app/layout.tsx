import "./globals.css";
import type { Metadata } from "next";

// ⬇️ your existing nav component (adjust the path/name to match your project)
import SiteHeader from "@/components/site-header"; 

// ⬇️ the live ticker wrapper we added
import NewsTickerLive from "@/components/news-ticker-live";

// (optional) your footer or other globals
// import SiteFooter from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white flex flex-col">
        {/* ✅ your top nav stays */}
        <SiteHeader />

        {/* ✅ ticker appears right under the nav and sticks to the top on scroll */}
        <div className="sticky top-0 z-30">
          <NewsTickerLive />
        </div>

        <main className="flex-1">{children}</main>

        {/* <SiteFooter /> */}
      </body>
    </html>
  );
}
