// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import TopNav from "@/components/top-nav";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "24/7 programming dedicated to truth, culture, history, and community uplift.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="bg-black text-white">
        {/* Only show TopNav if logged in */}
        {user ? <TopNav /> : null}
        {children}
      </body>
    </html>
  );
}
