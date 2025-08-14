// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming 24/7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {/* push content below fixed navbar */}
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
