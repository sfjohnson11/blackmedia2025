import "./globals.css";
import DisableContextMenu from "./components/DisableContextMenu";
import InactivityLogout from "./components/InactivityLogout";

export const metadata = {
  title: "Black Truth TV",
  description: "Black Truth TV Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DisableContextMenu />
        <InactivityLogout />
        {children}
      </body>
    </html>
  );
}
