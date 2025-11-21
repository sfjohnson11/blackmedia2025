// app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  // Anyone who hits the root URL "/" gets sent to /login
  redirect("/login");
}
