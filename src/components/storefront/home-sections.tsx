export { StyleDiscovery } from "./style-discovery";
import { formatRelative } from "@/lib/format";
import { localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-context";
import { useCategories, useReviews } from "@/lib/queries";
import { Link } from "@tanstack/react-router";
import { Quote } from "lucide-react";
import { StarRating } from "./star-rating";

const storyCopy = {
  fr: {
    title: "Le plaisir de retrouver sa chambre.",
    body: "Un imprimé pour changer d’ambiance, un plaid à garder près de soi. Ce sont les détails qui rendent une pièce familière.",
    cta: "Découvrir la boutique",
  },
  en: {
    title: "A room you look forward to coming back to.",
    body: "A print to change the mood, a throw to keep close. Small details make a room feel familiar.",
    cta: "Discover the shop",
  },
  ar: {
    title: "حلاوة كي ترجعي لغرفتك.",
    body: "نقشة تبدّل جو الغرفة وبلايد تخليه دايمًا قريب منك. هاذي التفاصيل الصغيرة هي اللي تخليك تحسي بالراحة فدارك.",
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
      <h2 className="mb-6 font-display text-2xl font-semibold tracking-[-0.02em] text-primary sm:text-3xl">
        {t("home.categories")}
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((category) => (
          <Link
            key={category.id}
            to="/category/$slug"
            params={{ slug: category.slug }}
            className="group flex min-h-18 items-center gap-2 overflow-hidden rounded-sm border border-outline bg-surface transition-colors hover:border-outline-hi hover:bg-surface-high"
          >
            {category.image_url && (
              <span className="size-16 shrink-0 overflow-hidden bg-surface-high">
                <img
                  src={category.image_url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </span>
            )}
            <span className="min-w-0 flex-1 px-4 py-3.5">
              <span className="block text-sm font-semibold text-primary group-hover:underline">
                {localized(locale, category.name, category.name_fr)}
              </span>
              <span className="text-xs text-on-surface-muted">
                {category.product_count} {t("nav.products")}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function BrandStory() {
  const { locale } = useI18n();
  const copy = storyCopy[locale];

  return (
    <section className="bg-brand py-12 text-ivory sm:py-16">
      <div className="container-page grid items-center gap-7 lg:grid-cols-[1fr_0.8fr] lg:gap-14">
        <h2 className="max-w-xl font-display text-3xl font-normal text-balance sm:text-5xl">
          {copy.title}
        </h2>
        <div>
          <p className="max-w-md text-base leading-relaxed">{copy.body}</p>
          <Link
            to="/catalogue"
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-ivory underline underline-offset-4"
          >
            {copy.cta}
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
    <section className="border-y border-outline bg-section-alt py-14">
      <div className="container-page">
        <div className="mb-8 flex flex-col items-center text-center">
          <h2 className="font-display text-2xl font-semibold text-primary sm:text-3xl">
            {t("home.reviews.title")}
          </h2>
          <p className="mt-2 max-w-lg text-sm text-on-surface-muted">{t("home.reviews.body")}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {top.map((review) => (
            <figure key={review.id} className="review-card">
              <Quote size={18} className="mb-3 text-primary" aria-hidden="true" />
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

export function ClosingCta() {
  const { t } = useI18n();
  return (
    <section className="container-page py-12 sm:py-16">
      <div className="flex flex-col items-center gap-4 rounded-sm border border-outline bg-surface px-5 py-10 text-center sm:px-10">
        <h2 className="max-w-xl font-display text-2xl font-semibold text-primary sm:text-3xl">
          {t("home.cta.title")}
        </h2>
        <p className="max-w-lg text-base leading-relaxed text-on-surface-muted">
          {t("home.cta.body")}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <a href="#catalogue" className="btn btn-primary btn-lg">
            {t("home.browseAll")}
          </a>
          <Link to="/track" className="btn btn-secondary btn-lg">
            {t("nav.trackOrder")}
          </Link>
        </div>
      </div>
    </section>
  );
}
