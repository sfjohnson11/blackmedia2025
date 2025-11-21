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
 * Load the profile row from user_profiles for a given Supabase auth user id.
 */
export async function loadProfileForUserId(
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles") // 👈 your real table
    .select("id,email,name,full_name,role,created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Error loading user_profiles:", error.message);
    return null;
  }

  return data as UserProfile | null;
}
