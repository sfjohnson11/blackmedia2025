// app/layout.tsx
import "./globals.css";
import TopNav from "@/components/top-nav";

export const metadata = {
  title: "Black Truth TV",
  description: "Multi-channel streaming network.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
