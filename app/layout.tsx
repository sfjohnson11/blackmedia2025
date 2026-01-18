// app/layout.tsx
import "./globals.css";
import DisableContextMenu from "@/app/components/DisableContextMenu";

export const metadata = {
  title: "Black Truth TV",
  description: "Black Truth TV Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <DisableContextMenu />
        {children}
      </body>
    </html>
  );
}
