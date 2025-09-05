// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import TopNav from "../components/top-nav"; // <- single global navbar

export const metadata = {
  title: "Black Truth TV",
  description: "Streaming channels",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen">
        <TopNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {children}
        </main>
      </body>
    </html>
  );
}
