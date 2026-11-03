import type { AdminProduct } from "@/lib/admin-products";
import { catalogReadiness } from "@/lib/catalog-readiness";

export function CatalogChecklist({ product }: { product: AdminProduct }) {
  return (
    <details open className="rounded-[12px] border border-outline p-4">
      <summary className="cursor-pointer font-medium">Avant publication</summary>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {catalogReadiness(product).map((check) => (
          <li key={check.label}>
            {check.ok ? "✓" : check.blocking ? "✕" : "⚠"} {check.label}
            {!check.ok && (check.blocking ? " — requis" : " — à vérifier")}
          </li>
        ))}
      </ul>
    </details>
  );
}
