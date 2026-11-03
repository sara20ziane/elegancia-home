export { StyleDiscovery } from "./style-discovery";
import { formatRelative } from "@/lib/format";
import { localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-context";
import { useCategories, useReviews } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Quote } from "lucide-react";
import { StarRating } from "./star-rating";

const storyCopy = {
  fr: {
    eyebrow: "L’ESPRIT ELEGANCIA",
    title: "Du linge de lit pensé pour embellir vos moments de repos.",
    body: "Des imprimés choisis avec soin, des couleurs qui réchauffent la chambre et cette sensation de douceur que l’on aime retrouver chaque soir.",
    cta: "Découvrir la boutique",
  },
  en: {
    eyebrow: "THE ELEGANCIA FEELING",
    title: "Bed linen designed to make rest feel more beautiful.",
    body: "Carefully selected prints, colours that warm the room and the softness you want to come home to every evening.",
    cta: "Discover the shop",
  },
  ar: {
    eyebrow: "روح ELEGANCIA",
    title: "مفروشات تزيد لحظات راحتك جمالاً.",
    body: "نقوش مختارة بعناية، ألوان تدفئ الغرفة ونعومة تحبي ترجعي لها كل ليلة.",
    cta: "اكتشفي المتجر",
  },
} as const;

/** Real category links once products have been published. */
export function CategoryStrip() {
  const { t, locale } = useI18n();
  const { data: categories } = useCategories();

  const visible = (categories ?? []).filter((category) => category.product_count > 0);
  if (visible.length === 0) return null;

  return (
    <section className="container-page py-12">
      <h2 className="mb-6 font-display text-2xl font-semibold tracking-[-0.02em] text-[#38281E] sm:text-3xl">
        {t("home.categories")}
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((category) => (
          <Link
            key={category.id}
            to="/category/$slug"
            params={{ slug: category.slug }}
            className="group flex items-center justify-between gap-3 rounded-[18px] border border-[#E5D8CD] bg-[#FFFDF9] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#D1B8A3] hover:shadow-sm"
          >
            {category.image_url && (
              <span className="size-16 shrink-0 overflow-hidden rounded-s-[18px] bg-[#F3ECE5]">
                <img
                  src={category.image_url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </span>
            )}
            <span className="min-w-0 flex-1 px-4 py-3.5">
              <span className="block truncate text-sm font-semibold text-[#4B392E]">
                {localized(locale, category.name, category.name_fr)}
              </span>
              <span className="font-mono text-xs text-[#7D7067]">
                {category.product_count} {t("nav.products")}
              </span>
            </span>
            <ArrowRight
              size={16}
              className="me-4 shrink-0 text-primary transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Editorial brand interlude inspired by Elegancia Home's warm Instagram imagery. */
export function BrandStory() {
  const { locale } = useI18n();
  const copy = storyCopy[locale];

  return (
    <section className="border-y border-[#E7DAD0] bg-[#EFE5DC] py-14 sm:py-20">
      <div className="container-page grid items-center gap-9 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
        <div className="relative min-h-[330px] overflow-hidden rounded-[28px] bg-[#D5C7BA] shadow-[0_22px_55px_rgba(74,53,38,0.12)] sm:min-h-[420px]">
          <div className="absolute inset-0 bg-[linear-gradient(150deg,#C8B6A6_0%,#EEE5DD_40%,#C6A9AA_72%,#9AA28F_100%)]" />
          <div className="absolute inset-x-[8%] top-[14%] h-[46%] rounded-t-[45%] bg-[#C7B6A8]/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,.45)]" />
          <div className="absolute inset-x-[4%] bottom-[8%] h-[49%] rounded-[18px] bg-[#F6F1EB] shadow-[0_14px_28px_rgba(62,43,31,.12)]" />
          <div className="absolute start-[9%] bottom-[27%] h-[25%] w-[40%] rotate-[-2deg] rounded-[13px] bg-[#BFC8B8] shadow-sm" />
          <div className="absolute end-[9%] bottom-[27%] h-[25%] w-[40%] rotate-[2deg] rounded-[13px] bg-[#E7CED0] shadow-sm" />
          <div className="absolute inset-x-[4%] bottom-[8%] h-[23%] rounded-b-[18px] bg-[repeating-linear-gradient(115deg,#F4EFE9_0_15px,#E9DDD1_15px_18px)] opacity-90" />
          <span className="absolute start-5 top-5 rounded-full border border-white/55 bg-white/65 px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.13em] text-[#654A39] backdrop-blur">
            ELEGANCIA HOME
          </span>
        </div>

        <div className="max-w-xl">
          <span className="text-[0.68rem] font-semibold tracking-[0.16em] text-primary">
            {copy.eyebrow}
          </span>
          <h2 className="mt-3 font-display text-[clamp(30px,4.5vw,50px)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#38281E]">
            {copy.title}
          </h2>
          <p className="mt-5 text-base leading-8 text-[#716158]">{copy.body}</p>
          <Link to="/catalogue" className="btn btn-primary btn-lg mt-7 inline-flex">
            {copy.cta}
            <ArrowRight size={17} className="rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Review wall, from the store's own approved reviews. */
export function ReviewWall() {
  const { t, locale } = useI18n();
  const { data: reviews } = useReviews();
  const top = (reviews ?? []).slice(0, 3);

  if (top.length === 0) return null;

  return (
    <section className="border-y border-[#E7DAD0] bg-[#F7F1EA] py-14">
      <div className="container-page">
        <div className="mb-8 flex flex-col items-center text-center">
          <h2 className="font-display text-2xl font-semibold text-[#38281E] sm:text-3xl">
            {t("home.reviews.title")}
          </h2>
          <p className="mt-2 max-w-lg text-sm text-[#76685E]">{t("home.reviews.body")}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {top.map((review) => (
            <figure key={review.id} className="review-card">
              <Quote size={18} className="mb-3 text-[#BFA693]" aria-hidden="true" />
              <StarRating value={review.rating} className="mb-3" />
              <blockquote className="review-body">{review.comment}</blockquote>
              <figcaption className="mt-4 flex items-center gap-2.5">
                <span className="review-ava" aria-hidden="true">
                  {review.customer_name.trim().charAt(0)}
                </span>
                <span>
                  <span className="block text-sm font-medium">{review.customer_name}</span>
                  <span className="text-xs text-on-surface-muted">
                    {formatRelative(review.created_at, locale)}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Closing call to action. */
export function ClosingCta({ storeName }: { storeName: string }) {
  const { t } = useI18n();
  return (
    <section className="container-page py-14 sm:py-18">
      <div
        className={cn(
          "relative overflow-hidden rounded-[28px] border border-[#E3D5C9] bg-[#FFF9F3] px-6 py-12 text-center sm:px-10 sm:py-16",
        )}
      >
        <div className="pointer-events-none absolute -top-16 -end-12 size-56 rounded-full bg-[#DDBFA5]/25 blur-3xl" />
        <div className="relative flex flex-col items-center gap-4">
          <h2 className="max-w-xl font-display text-2xl font-semibold tracking-[-0.02em] text-[#38281E] sm:text-3xl">
            {t("home.cta.title")}
          </h2>
          <p className="max-w-lg text-sm leading-7 text-[#76685E] sm:text-base">
            {t("home.cta.body")}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <a href="#catalogue" className="btn btn-primary btn-lg">
              {t("home.browseAll")}
            </a>
            <Link to="/track" className="btn btn-secondary btn-lg border-[#D6C3B3] bg-white/60">
              {t("nav.trackOrder")}
            </Link>
          </div>
          <p className="mt-2 text-xs font-semibold tracking-[0.12em] text-primary uppercase">
            {storeName}
          </p>
        </div>
      </div>
    </section>
  );
}
