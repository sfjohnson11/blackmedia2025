// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import TopNav from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description:
    "24/7 programming dedicated to truth, culture, history, and community uplift.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
