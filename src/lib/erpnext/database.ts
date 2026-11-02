import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { ErpError } from "./errors";

export function financeDatabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret)
    throw new ErpError("configuration", "Configuration Supabase serveur finance manquante.");
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5_000) }),
    },
  });
}
