import "./globals.css";
import type { ReactNode } from "react";
import { Navbar } from "@/components/navbar";
import SiteTicker from "@/components/site-ticker"; // <- our single ticker

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <Navbar />
        <SiteTicker speed={12} /> {/* ONE ticker, fast enough to see it move */}
        <main>{children}</main>
      </body>
    </html>
  );
}

