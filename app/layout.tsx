// app/layout.tsx
import "./globals.css";
import TopNav from "@/components/top-nav";
import SupabaseProvider from "@/components/SupabaseProvider";

export const metadata = {
  title: "Black Truth TV",
  description: "Multi-channel streaming network.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white">
        <SupabaseProvider>
          <TopNav />
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
