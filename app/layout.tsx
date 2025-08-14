import "./globals.css";
import { Navbar } from "@/components/navbar";
import { BreakingNews } from "@/components/breaking-news";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <Navbar />
        <BreakingNews />  {/* ticker appears once, under the fixed navbar */}
        <main>{children}</main>
      </body>
    </html>
  );
}
