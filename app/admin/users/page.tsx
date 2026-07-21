// app/admin/users/page.tsx
import AdminUsersClient from "./_client";

export const metadata = {
  title: "Members | Admin | Black Truth TV",
};

export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return <AdminUsersClient />;
}
