import { BRAND_NAME, brandCopy } from "@/lib/brand";
import { localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-context";
import { productImageAlt } from "@/lib/product-image-alt";
import { productImage, type CatalogueProduct } from "@/lib/queries";
import { Link } from "@tanstack/react-router";
import { Banknote, ShieldCheck, Truck } from "lucide-react";

const editorialCopy = {
  fr: {
    title: "La douceur, jusque dans les détails.",
    body: "Des parures aux plaids, retrouvez les couleurs et les matières qui donnent à votre maison son caractère.",
    cta: "Découvrir la collection",
  },
  en: {
    title: "Softness in every detail.",
    body: "From bedding sets to throws, find the colours and textures that make your home feel like yours.",
    cta: "Explore the collection",
  },
  ar: {
    title: "النعومة فكل تفصيلة.",
    body: "من أطقم الفرش للبلايدات، اختاري الألوان والخامات اللي تعطيلك لمستك فالدار.",
    cta: "اكتشفي المجموعة",
  },
} as const;

const trustCopy = {
  fr: [
    ["Paiement à la livraison", "Réglez votre commande à la réception."],
    ["Livraison en Algérie", "Selon les communes desservies par Packers."],
    ["Commande suivie", "Consultez son état depuis la boutique."],
  ],
  en: [
    ["Cash on delivery", "Pay when your order arrives."],
    ["Delivery in Algeria", "Subject to Packers coverage in your area."],
    ["Order tracking", "Check your order status from the shop."],
  ],
  ar: [
    ["الدفع عند الاستلام", "خلصي كي يوصلك طلبك."],
    ["التوصيل في الجزائر", "حسب البلديات اللي تغطيها Packers."],
    ["تتبع الطلب", "شوفي وين راه وصل طلبك من الموقع."],
  ],
} as const;

export function HomeHero({ products }: { products: CatalogueProduct[] }) {
  const { locale, t } = useI18n();
  const copy = editorialCopy[locale];
  const featured = products.find((product) => productImage(product) !== null);
  const photo = featured ? productImage(featured) : null;

  return (
    <section className="border-b border-outline bg-section-alt">
      <div className="container-page grid items-stretch gap-7 py-8 sm:py-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10 lg:py-14">
        <div className="flex flex-col items-start justify-center py-3 sm:py-7">
          <p className="section-label mb-4">{brandCopy(locale).category}</p>
          <h1 className="max-w-xl font-display text-[clamp(2.4rem,5.4vw,5.2rem)] leading-[1.05] font-normal text-primary">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-on-surface-muted sm:text-lg">
            {copy.body}
          </p>
          <div className="mt-7 flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <Link to="/catalogue" className="btn btn-primary btn-lg">
              {copy.cta}
            </Link>
            <Link to="/track" className="btn btn-secondary btn-lg">
              {t("nav.trackOrder")}
            </Link>
          </div>
        </div>

        {featured && photo ? (
          <Link
            to="/product/$slug"
            params={{ slug: featured.slug }}
            className="group overflow-hidden rounded-t-[3rem] rounded-b-sm border border-outline bg-surface lg:rounded-t-[5rem]"
          >
            <div className="overflow-hidden bg-surface-high">
              <img
                src={photo}
                alt={productImageAlt(featured, photo, locale)}
                fetchPriority="high"
                decoding="async"
                className="aspect-[4/3] w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
              />
            </div>
            <span className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
              <span className="font-display text-xl text-primary">
                {localized(locale, featured.name, featured.name_fr)}
              </span>
              <span className="text-sm font-semibold text-primary group-hover:underline">
                {t("store.viewDetails")}
              </span>
            </span>
          </Link>
        ) : (
          <div className="grid min-h-44 place-items-center rounded-t-[3rem] rounded-b-sm border border-outline-hi bg-surface sm:min-h-72 lg:rounded-t-[5rem]">
            <img
              src="/brand/cotonia-signature.svg"
              alt={BRAND_NAME}
              width="190"
              height="145"
              className="h-auto w-36 rounded-xs bg-ivory p-3 sm:w-48"
            />
          </div>
        )}
      </div>
    </section>
  );
}

export function TrustBar({ acceptsCod }: { acceptsCod: boolean }) {
  const { locale } = useI18n();
  const icons = [Banknote, Truck, ShieldCheck] as const;

  return (
    <ul className="container-page grid gap-5 border-b border-outline py-6 sm:grid-flow-col sm:auto-cols-fr lg:py-8">
      {trustCopy[locale].map(([title, body], index) => {
        if (index === 0 && !acceptsCod) return null;
        const Icon = icons[index];
        return (
          <li key={title} className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-high text-primary">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-on-surface-muted">
                {body}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
