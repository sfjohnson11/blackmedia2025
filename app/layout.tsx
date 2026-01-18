// app/layout.tsx
import "./globals.css";
import DisableContextMenu from "./components/DisableContextMenu";

export const metadata = {
  title: "Black Truth TV",
  description: "Black Truth TV Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DisableContextMenu />
        {children}
      </body>
    </html>
  );
}
