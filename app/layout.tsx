// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/header";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming 24/7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="bg-black text-white min-h-screen">
        <Header />
        <main className="pt-14">{children}</main>
      </body>
    </html>
  );
}
