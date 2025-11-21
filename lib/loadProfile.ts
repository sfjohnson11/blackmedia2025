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
 * Load the profile row from user_profiles for a given email.
 * This is the ONLY place we hit user_profiles.
 */
export async function loadProfileForEmail(
  email: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles") // 👈 your real table
    .select("id,email,name,full_name,role,created_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.warn("Error loading user_profiles:", error.message);
    return null;
  }

  return data as UserProfile | null;
}
