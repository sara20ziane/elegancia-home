import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";

function userClient(accessToken: string) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function assertAdmin(accessToken: string) {
  const supabase = userClient(accessToken);
  if (!supabase) return { error: "Server Supabase configuration is missing.", supabase: null };

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return { error: "Not signed in.", supabase: null };

  const { data: role, error: roleError } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (roleError || !role) {
    return {
      error: roleError?.message ?? "This account is not a shop administrator.",
      supabase: null,
    };
  }
  return { error: null, supabase };
}
