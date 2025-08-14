import "./globals.css";
import type { Metadata } from "next";
import AdminLoginButton from "@/components/admin-login-button";

export const metadata: Metadata = {
  title: "Black Truth TV",
  description: "Streaming network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white flex flex-col">
        <main className="flex-1">{children}</main>

        {/* Floating Admin Login button */}
        <AdminLoginButton />
      </body>
    </html>
  );
}
