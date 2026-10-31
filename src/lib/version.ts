import { queryOptions } from "@tanstack/react-query";
import { getSupabase } from "./supabase/client";
export const CODE_VERSION = "0.1.0-elegancia-selected-v020";
export const UPSTREAM_REVIEWED_VERSION = "0.2.0";
export const SCHEMA_VERSION = 1;
export function isNewer(latest: string, current: string) {
  const parse = (value: string) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number);
  const a = parse(latest),
    b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
export const latestVersionQuery = () =>
  queryOptions({
    queryKey: ["upstream_release"],
    staleTime: 6 * 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const response = await fetch(
        "https://api.github.com/repos/Meykiio/openstore-dz/releases/latest",
        { signal: AbortSignal.timeout(5000), cache: "no-store" },
      );
      if (!response.ok) throw new Error("Release unavailable");
      const data: unknown = await response.json();
      if (!data || typeof data !== "object") return null;
      const row = data as Record<string, unknown>;
      if (
        row.draft ||
        row.prerelease ||
        typeof row.tag_name !== "string" ||
        !/^v?\d+\.\d+\.\d+$/.test(row.tag_name)
      )
        return null;
      return {
        version: row.tag_name,
        url: `https://github.com/Meykiio/openstore-dz/releases/tag/${encodeURIComponent(row.tag_name)}`,
      };
    },
  });
export const schemaVersionQuery = () =>
  queryOptions({
    queryKey: ["elegancia_schema_version"],
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("elegancia_schema_version");
      if (error?.code === "PGRST202" || error?.code === "42883") return 0;
      if (error || typeof data !== "number") throw new Error("Schema version unavailable");
      return data;
    },
  });
