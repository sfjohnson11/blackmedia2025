// app/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Not logged in → send to login
  if (!session) {
    redirect("/login");
  }

  // Logged in → send to network home / live channels
  redirect("/watch");
}
