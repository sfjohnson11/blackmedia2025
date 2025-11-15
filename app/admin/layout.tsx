// app/admin/layout.tsx
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // No Supabase / redirects yet – just wrap the admin pages.
  return (
    <div className="min-h-screen bg-black text-white">
      {children}
    </div>
  );
}
