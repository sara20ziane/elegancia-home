import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  Headphones,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import type { CatalogueProduct, StoreSettings } from "@/lib/queries";
import { productImage } from "@/lib/queries";
import { localized } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const fallbackVisuals = {
  fr: ["Neutres & élégants", "Fleurs & motifs", "Tons doux"],
  en: ["Soft neutrals", "Florals & patterns", "Gentle tones"],
  ar: ["ألوان هادئة", "نقوش وزهور", "درجات ناعمة"],
} as const;

const editorialCopy = {
  fr: {
    eyebrow: "LINGE DE LIT · ELEGANCIA HOME",
    secure: "Commande suivie",
  },
  en: {
    eyebrow: "BED LINEN · ELEGANCIA HOME",
    secure: "Order tracking",
  },
  ar: {
    eyebrow: "مفروشات راقية · ELEGANCIA HOME",
    secure: "تتبع الطلب",
  },
} as const;

/** Premium storefront hero tailored to Elegancia Home's bedding identity. */
export function HomeHero({
  settings,
  products,
}: {
  settings: StoreSettings | null;
  products: CatalogueProduct[];
}) {
  const { t, locale } = useI18n();
  const shots = products
    .map((product) => ({ product, image: productImage(product) }))
    .filter((shot): shot is { product: CatalogueProduct; image: string } => shot.image !== null)
    .slice(0, 3);

  const copy = editorialCopy[locale];
  const placeholders = fallbackVisuals[locale];

  return (
    <section className="relative overflow-hidden border-b border-outline bg-[#F7F1EA] text-[#38281E]">
      <div
        className="pointer-events-none absolute -top-24 -end-20 size-72 rounded-full bg-[#D8B99C]/25 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -start-12 size-64 rounded-full bg-[#C8B9A7]/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="container-page relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:py-24">
        <div className="flex flex-col items-start">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#DCCCBD] bg-white/65 px-3.5 py-1.5 text-[0.68rem] font-semibold tracking-[0.12em] text-primary backdrop-blur-sm">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            {copy.eyebrow}
          </span>

          <h1 className="mb-5 max-w-[640px] font-display text-[clamp(38px,6vw,70px)] font-semibold leading-[0.98] tracking-[-0.035em] text-[#38281E]">
            {t("home.hero.title")}
          </h1>

          <p className="mb-8 max-w-[540px] text-base leading-[1.8] text-[#75675D] sm:text-lg">
            {t("home.hero.body")}
          </p>

          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <Link
              to="/catalogue"
              className="btn btn-primary btn-lg flex-1 shadow-[0_12px_30px_rgba(95,55,25,0.14)] sm:flex-none"
            >
              {t("home.promo.cta")}
              <ArrowRight size={18} className="rtl:rotate-180" aria-hidden="true" />
            </Link>
            <Link
              to="/track"
              className="btn btn-secondary btn-lg flex-1 border-[#CBB7A5] bg-white/55 sm:flex-none"
            >
              {t("nav.trackOrder")}
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium text-[#75675D] sm:text-sm">
            <li className="inline-flex items-center gap-1.5">
              <Banknote size={16} className="text-primary" aria-hidden="true" />
              {t("home.trust.cod.title")}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Truck size={16} className="text-primary" aria-hidden="true" />
              {t("home.trust.delivery.title")}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-primary" aria-hidden="true" />
              {copy.secure}
            </li>
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[620px]">
          <div
            className="pointer-events-none absolute inset-x-[10%] bottom-[-22px] h-20 rounded-[50%] bg-[#8D6D55]/12 blur-2xl"
            aria-hidden="true"
          />

          {shots.length > 0 ? (
            <div className="grid grid-cols-3 items-start gap-3 sm:gap-4">
              {shots.map(({ product, image }, index) => {
                const name = localized(locale, product.name, product.name_fr);
                return (
                  <Link
                    key={product.id}
                    to="/product/$slug"
                    params={{ slug: product.slug }}
                    className={cn(
                      "group relative block overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-[0_18px_45px_rgba(76,55,40,0.14)]",
                      index === 1 && "mt-10 sm:mt-14",
                    )}
                  >
                    <img
                      src={image}
                      alt={name}
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : "auto"}
                      decoding="async"
                      className="aspect-[4/5] w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.04]"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2E2018]/75 to-transparent px-3 pt-10 pb-3 text-xs font-medium text-white">
                      <span className="line-clamp-1">{name}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 items-start gap-3 sm:gap-4" aria-hidden="true">
              {placeholders.map((label, index) => {
                const backgrounds = [
                  "linear-gradient(155deg, #DED7CE 0%, #F8F3ED 62%, #C8B7A6 100%)",
                  "linear-gradient(155deg, #D7C0C2 0%, #F4E9E7 58%, #B88C91 100%)",
                  "linear-gradient(155deg, #BCC4B7 0%, #F5F0E8 58%, #8E9D8A 100%)",
                ];
                const patterns = [
                  "radial-gradient(circle at 20% 20%, rgba(255,255,255,.78) 0 13%, transparent 14%), radial-gradient(circle at 78% 72%, rgba(255,255,255,.42) 0 18%, transparent 19%)",
                  "radial-gradient(ellipse at 25% 30%, rgba(255,255,255,.58) 0 11%, transparent 12%), radial-gradient(ellipse at 70% 58%, rgba(255,255,255,.5) 0 14%, transparent 15%)",
                  "linear-gradient(35deg, rgba(255,255,255,.36) 25%, transparent 25% 55%, rgba(255,255,255,.22) 55% 72%, transparent 72%)",
                ];
                return (
                  <div
                    key={label}
                    className={cn(
                      "relative aspect-[4/5] overflow-hidden rounded-[22px] border border-white/70 shadow-[0_18px_45px_rgba(76,55,40,0.14)]",
                      index === 1 && "mt-10 sm:mt-14",
                    )}
                    style={{ background: backgrounds[index] }}
                  >
                    <span
                      className="absolute inset-0 opacity-70"
                      style={{ backgroundImage: patterns[index] }}
                    />
                    <span className="absolute inset-x-3 bottom-3 rounded-full border border-white/45 bg-white/60 px-3 py-2 text-center text-[0.66rem] font-semibold tracking-wide text-[#4C3A30] backdrop-blur-sm sm:text-xs">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Compact reassurance band beneath the main commercial sections. */
export function TrustBar({ returnsDays }: { returnsDays: number }) {
  const { t } = useI18n();

  const items = [
    { icon: Banknote, title: t("home.trust.cod.title"), body: t("home.trust.cod.body") },
    {
      icon: Truck,
      title: t("home.trust.delivery.title"),
      body: t("home.trust.delivery.body"),
    },
    {
      icon: RotateCcw,
      title: t("home.trust.returns.title", { days: returnsDays }),
      body: t("home.trust.returns.body"),
    },
    { icon: Headphones, title: t("home.trust.support.title"), body: t("home.trust.support.body") },
  ] as const;

  return (
    <section className="border-y border-[#E8DDD3] bg-[#FFFDF9]">
      <div className="container-page grid gap-5 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:py-9">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#E3D4C7] bg-[#F7F1EA] text-primary">
              <item.icon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#38281E]">{item.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-[#786B61]">{item.body}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
