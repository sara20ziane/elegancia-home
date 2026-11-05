import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useStoreSettings } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/client";
import { configurationChecks, type SetupAudit } from "@/lib/setup-audit";

export function SetupChecklist() {
  const settings = useStoreSettings();
  const audit = useQuery({
    queryKey: ["admin_setup_audit"],
    refetchInterval: 30000,
    queryFn: async () => {
      const result = await getSupabase().rpc("admin_setup_audit");
      if (result.error) throw new Error(result.error.message);
      return result.data as unknown as SetupAudit;
    },
  });
  if (settings.isPending || audit.isPending)
    return <p className="text-sm">Vérification de la configuration…</p>;
  if (audit.isError || settings.isError)
    return (
      <p role="alert" className="text-sm">
        Checklist indisponible. Les autres outils restent accessibles.
      </p>
    );
  const checks = configurationChecks(settings.data ?? null, audit.data);
  const complete = checks.filter((check) => check.ok).length;
  return (
    <details
      className="rounded-[16px] border border-outline bg-surface p-5"
      open={complete < checks.length}
    >
      <summary className="cursor-pointer font-semibold">
        Configuration · {complete}/{checks.length}
      </summary>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center justify-between gap-3">
            <span>
              {check.ok ? "✓" : "⚠"} {check.label}
            </span>
            <Link className="text-primary underline" to={check.to}>
              {check.ok ? "Voir" : "Corriger"}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-on-surface-muted">
        Diagnostic informatif, actualisé après modification. La détection de démonstration vérifie
        les marqueurs connus ; relisez aussi le catalogue et les textes publics.
      </p>
    </details>
  );
}
