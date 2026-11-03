import type { User } from "@supabase/supabase-js";
import { createContext, useContext } from "react";
import type { Database } from "./supabase/types";

export type AdminRole = Database["public"]["Enums"]["admin_role"];

export type AuthValue = {
  user: User | null;
  role: AdminRole | null;
  /** True only for a signed-in user with a row in `admin_users`. */
  isAdmin: boolean;
  /** True while the initial session and role lookup are still resolving. */
  loading: boolean;
  configMissing: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
