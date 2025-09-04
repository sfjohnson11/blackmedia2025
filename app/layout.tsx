// app/layout.tsx
import "./globals.css"; // keep if you have Tailwind or global styles

export const metadata = {
  title: "Black Truth TV",
  description: "24/7 streaming",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
