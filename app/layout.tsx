// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Black Truth TV",
  description: "Black Truth TV Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
