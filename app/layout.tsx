// app/layout.tsx
import "./globals.css";
import { SupabaseProvider } from "@/components/SupabaseProvider";

export const metadata = {
  title: "Black Truth TV",
  description: "Multi-channel streaming network featuring news, culture, and education.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white">
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
