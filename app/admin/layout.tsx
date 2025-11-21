// app/admin/layout.tsx
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#ffffff",
      }}
    >
      {children}
    </div>
  );
}
