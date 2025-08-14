import { requireAnyRole } from "@/lib/roles";
import AdminUsersClient from "./_client";

export default async function AdminUsersPage() {
  const gate = await requireAnyRole(["admin"]);
  if (!gate.ok) {
    return <meta httpEquiv="refresh" content={`0; url=${gate.redirect}`} />;
  }
  return <AdminUsersClient />;
}
