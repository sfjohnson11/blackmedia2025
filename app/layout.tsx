// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Black Truth TV",
  description: "Live and on-demand programming",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
