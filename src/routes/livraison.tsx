import { createFileRoute } from "@tanstack/react-router";
import { Gift, Home, MapPin, Store, Truck } from "lucide-react";
import { StoreLayout } from "@/components/storefront/store-layout";
import { useDeliveryZones } from "@/lib/delivery";
import { formatDzd } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import { WILAYAS } from "@/lib/wilayas";

const copy = {
  fr: {
    title: "Livraison",
    intro:
      "Elegancia Home expédie avec Packers / EcoTrack. Les tarifs affichés ci-dessous sont synchronisés depuis Packers et peuvent être actualisés sans modifier le site.",
    origin: "Départ Alger",
    originBody: "Toutes les expéditions Elegancia Home partent d’Alger.",
    home: "Livraison à domicile",
    homeBody: "Le tarif dépend de la wilaya de destination.",
    stop: "Stop Desk Packers",
    stopBody:
      "Disponible uniquement dans les communes indiquées par Packers. Si la commune choisie n’a pas de Stop Desk, cette option est automatiquement désactivée au checkout.",
    offer: "Offre livraison Elegancia",
    offerBody:
      "2 parures achetées : livraison Stop Desk offerte · 3 parures achetées ou plus : livraison à domicile offerte.",
    rates: "Tarifs Packers actuellement synchronisés",
    rateNote:
      "Les montants ci-dessous sont les tarifs de base. Une offre Elegancia éligible est appliquée automatiquement au checkout.",
    wilaya: "Wilaya",
    homeCol: "Domicile",
    stopCol: "Stop Desk",
    unavailable: "Non disponible",
    empty: "Les tarifs Packers ne sont pas encore disponibles.",
    communeNote:
      "La disponibilité réelle du Stop Desk est vérifiée selon la commune sélectionnée au moment de la commande.",
    cod: "Paiement à la livraison",
    codBody: "Le montant de la commande est réglé à la réception.",
  },
  en: {
    title: "Delivery",
    intro:
      "Elegancia Home ships with Packers / EcoTrack. The rates below are synchronized from Packers and can be refreshed without changing the site.",
    origin: "Dispatch from Algiers",
    originBody: "All Elegancia Home parcels are dispatched from Algiers.",
    home: "Home delivery",
    homeBody: "The rate depends on the destination wilaya.",
    stop: "Packers Stop Desk",
    stopBody:
      "Available only in communes supported by Packers. If the selected commune has no Stop Desk, this option is automatically disabled at checkout.",
    offer: "Elegancia delivery offer",
    offerBody:
      "Buy 2 bedding sets: free Stop Desk delivery · Buy 3 or more bedding sets: free home delivery.",
    rates: "Currently synchronized Packers rates",
    rateNote:
      "These are the base rates. Any eligible Elegancia offer is applied automatically at checkout.",
    wilaya: "Wilaya",
    homeCol: "Home",
    stopCol: "Stop Desk",
    unavailable: "Unavailable",
    empty: "Packers rates are not available yet.",
    communeNote:
      "Actual Stop Desk availability is checked for the selected commune when the order is placed.",
    cod: "Cash on delivery",
    codBody: "The order total is paid when the parcel is received.",
  },
  ar: {
    title: "التوصيل",
    intro:
      "تعتمد Elegancia Home على Packers / EcoTrack. الأسعار أدناه متزامنة مباشرة مع Packers ويمكن تحديثها دون تغيير الموقع.",
    origin: "الانطلاق من الجزائر",
    originBody: "كل شحنات Elegancia Home تنطلق من الجزائر العاصمة.",
    home: "التوصيل إلى المنزل",
    homeBody: "السعر يختلف حسب ولاية الوجهة.",
    stop: "Packers Stop Desk",
    stopBody:
      "متوفر فقط في البلديات التي تحددها Packers. إذا لم يوجد Stop Desk في البلدية المختارة، يتم تعطيل الخيار تلقائياً عند الطلب.",
    offer: "عرض التوصيل من Elegancia",
    offerBody:
      "عند شراء طقمين: Stop Desk مجاني · عند شراء 3 أطقم أو أكثر: التوصيل إلى المنزل مجاني.",
    rates: "أسعار Packers المتزامنة حالياً",
    rateNote:
      "هذه هي الأسعار الأساسية. إذا كان الطلب مؤهلاً لعرض Elegancia يتم تطبيق المجانية تلقائياً عند إتمام الطلب.",
    wilaya: "الولاية",
    homeCol: "المنزل",
    stopCol: "Stop Desk",
    unavailable: "غير متوفر",
    empty: "أسعار Packers غير متوفرة حالياً.",
    communeNote: "يتم التحقق من توفر Stop Desk فعلياً حسب البلدية المختارة أثناء الطلب.",
    cod: "الدفع عند الاستلام",
    codBody: "يتم دفع مبلغ الطلب عند استلام الطرد.",
  },
} as const;

export const Route = createFileRoute("/livraison")({
  head: ({ match }) => ({
    meta: [{ title: `${copy[match.context.locale].title} — Elegancia Home` }],
  }),
  component: DeliveryInfoPage,
});

function DeliveryInfoPage() {
  const { locale } = useI18n();
  const { data: zones, isPending } = useDeliveryZones();
  const c = copy[locale];
  const sorted = [...(zones ?? [])].sort((a, b) => wilayaCode(a.wilaya) - wilayaCode(b.wilaya));

  return (
    <StoreLayout>
      <main className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <span className="section-label">Packers · EcoTrack</span>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            {c.title}
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-on-surface-muted">{c.intro}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <InfoCard icon={MapPin} title={c.origin} body={c.originBody} />
            <InfoCard icon={Home} title={c.home} body={c.homeBody} />
            <InfoCard icon={Store} title={c.stop} body={c.stopBody} />
          </div>

          <section className="mt-6 rounded-[18px] border border-primary/25 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <Gift size={21} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{c.offer}</h2>
                <p className="mt-1 text-sm leading-6 text-on-surface-muted">{c.offerBody}</p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-4">
              <h2 className="font-display text-2xl font-semibold">{c.rates}</h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-muted">{c.rateNote}</p>
            </div>

            {isPending ? (
              <div className="rounded-[16px] border border-outline bg-surface p-6 text-sm text-on-surface-muted">
                …
              </div>
            ) : sorted.length === 0 ? (
              <div className="rounded-[16px] border border-outline bg-surface p-6 text-sm text-on-surface-muted">
                {c.empty}
              </div>
            ) : (
              <div className="overflow-hidden rounded-[16px] border border-outline bg-surface">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-surface-mid text-start text-xs uppercase tracking-wide text-on-surface-muted">
                      <tr>
                        <th className="px-4 py-3 text-start font-medium">{c.wilaya}</th>
                        <th className="px-4 py-3 text-end font-medium">{c.homeCol}</th>
                        <th className="px-4 py-3 text-end font-medium">{c.stopCol}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {sorted.map((zone) => (
                        <tr key={zone.wilaya}>
                          <td className="px-4 py-3 font-medium">{wilayaLabel(zone.wilaya, locale)}</td>
                          <td className="px-4 py-3 text-end font-mono" dir="ltr">
                            {formatDzd(zone.fee, locale)}
                          </td>
                          <td className="px-4 py-3 text-end font-mono" dir="ltr">
                            {zone.stopdesk_fee === null
                              ? c.unavailable
                              : formatDzd(zone.stopdesk_fee, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-outline px-4 py-3 text-xs text-on-surface-muted">
                  {c.communeNote}
                </p>
              </div>
            )}
          </section>

          <section className="mt-6 flex items-start gap-3 rounded-[16px] border border-outline bg-surface p-5">
            <Truck size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">{c.cod}</h2>
              <p className="mt-1 text-sm text-on-surface-muted">{c.codBody}</p>
            </div>
          </section>
        </div>
      </main>
    </StoreLayout>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Home;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-[16px] border border-outline bg-surface p-5">
      <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon size={18} aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-on-surface-muted">{body}</p>
    </article>
  );
}

function wilayaCode(name: string) {
  return WILAYAS.find((wilaya) => wilaya.fr === name || wilaya.ar === name)?.code ?? 999;
}

function wilayaLabel(name: string, locale: "ar" | "fr" | "en") {
  const wilaya = WILAYAS.find((item) => item.fr === name || item.ar === name);
  return wilaya ? (locale === "ar" ? wilaya.ar : wilaya.fr) : name;
}
