// lib/loadProfile.ts
import { supabase } from "@/lib/supabase";

export type Role = "admin" | "member" | "student";

export type UserProfile = {
  id: string;
  email: string | null;
  name: string | null;
  full_name: string | null;
  role: Role | null;
  created_at: string | null;
};

/**
 * Load the user profile from user_profiles by email.
 */
export async function loadProfileByEmail(
  email: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles") // 👈 your table
    .select("id,email,name,full_name,role,created_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.warn("Error loading user_profiles:", error.message);
    return null;
  }

  return data as UserProfile | null;
}
