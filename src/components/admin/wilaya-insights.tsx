import { Badge } from "@/components/ui/badge";
import { formatDzd } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import { wilayaLabel } from "@/lib/wilayas";
import type { Analytics } from "@/lib/analytics";

export function WilayaTable({ analytics }: { analytics: Analytics }) {
  const { locale } = useI18n();
  return (
    <section className="min-w-0 rounded-[16px] border border-outline bg-surface p-5">
      <h2 className="text-sm font-semibold">Refus et ventes par wilaya</h2>
      <p className="my-2 text-xs text-on-surface-muted">
        Classement à partir de {analytics.minOrders} commandes. Refus, annulations et retours sont
        distincts. La période suit la date de création des commandes.
      </p>
      <div className="overflow-x-auto">
        <table className="ds-table">
          <caption className="sr-only">Refus et ventes par wilaya</caption>
          <thead>
            <tr>
              {[
                "Rang",
                "Wilaya",
                "Commandes",
                "Refus",
                "Taux",
                "Montant refusé",
                "Retours",
                "Annulations",
                "Valeur livrée",
              ].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analytics.byWilaya.map((row, index) => (
              <tr key={row.wilaya}>
                <td>{row.eligible ? index + 1 : "Échantillon insuffisant"}</td>
                <td>{wilayaLabel(row.wilaya, locale)}</td>
                <td className="cell-mono">{row.total}</td>
                <td className="cell-mono">{row.refused}</td>
                <td>
                  <Badge tone={row.eligible && row.rate >= 0.2 ? "warning" : "neutral"}>
                    {Math.round(row.rate * 100)} %
                  </Badge>
                </td>
                <td className="cell-mono">{formatDzd(row.refusedValue, locale)}</td>
                <td className="cell-mono">{row.returned}</td>
                <td className="cell-mono">{row.cancelled}</td>
                <td className="cell-mono">{formatDzd(row.deliveredValue, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!analytics.byWilaya.length && <p className="text-sm">Aucune commande sur cette période.</p>}
    </section>
  );
}

export function SlowProducts({ analytics }: { analytics: Analytics }) {
  return (
    <section className="rounded-[16px] border border-outline bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold">Produits peu vendus · commandes confirmées</h2>
      <ul className="space-y-2 text-sm">
        {analytics.slowProducts.map((p) => (
          <li key={p.name} className="flex justify-between gap-3">
            <span>{p.name}</span>
            <span>{p.units} unités</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
