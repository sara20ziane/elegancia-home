import { SetupCheck } from "@/components/setup-check";
import { HomeHero, TrustBar } from "@/components/storefront/home-hero";
import {
  BrandStory,
  CategoryStrip,
  ClosingCta,
  ReviewWall,
  StyleDiscovery,
} from "@/components/storefront/home-sections";
import { ProductGrid } from "@/components/storefront/product-card";
import { StoreLayout } from "@/components/storefront/store-layout";
import { EmptyState, ErrorState, ProductSkeleton } from "@/components/ui/feedback";
import { EMPTY_FILTERS, cataloguePageQuery, useCataloguePage } from "@/lib/catalogue";
import { BRAND_NAME, brandCopy } from "@/lib/brand";
import { useI18n } from "@/lib/i18n-context";
import { reviewsQuery, storeSettingsQuery } from "@/lib/queries";
import { canonicalUrl } from "@/lib/seo";
import { supabaseConfigProblem } from "@/lib/supabase/client";
import { isEmptyDatabaseError } from "@/lib/supabase/health";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

const emptyCopy = {
  fr: {
    title: "La collection Cotonia Home arrive bientôt.",
    body: "Les premiers modèles sont en préparation. Revenez bientôt pour découvrir les parures disponibles.",
  },
  en: {
    title: "The Cotonia Home collection is coming soon.",
    body: "Our first designs are being prepared. Come back soon to discover the available bedding sets.",
  },
  ar: {
    title: "مجموعة Cotonia Home راهي جاية قريب.",
    body: "نحضّر أول الموديلات بعناية. عودي قريباً لاكتشاف الأطقم المتوفرة.",
  },
} as const;

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const [settings] = await Promise.all([
      context.queryClient.ensureQueryData(storeSettingsQuery()).catch(() => null),
      context.queryClient.ensureQueryData(reviewsQuery()).catch(() => null),
      context.queryClient.ensureQueryData(cataloguePageQuery(EMPTY_FILTERS, 1)).catch(() => null),
    ]);
    return { settings };
  },
  head: ({ match }) => {
    const copy = brandCopy(match.context.locale);
    const title = `${BRAND_NAME} | ${copy.category}`;
    const description = copy.description;
    const image = canonicalUrl("/icon-512.png");
    const url = canonicalUrl("/");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: BRAND_NAME },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { property: "og:image:alt", content: BRAND_NAME },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:image", content: image },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: Home,
});

function Home() {
  const { t, locale } = useI18n();
  const { settings } = Route.useLoaderData();
  const catalogue = useCataloguePage(EMPTY_FILTERS, 1);
  const configProblem = supabaseConfigProblem();

  if (configProblem || (catalogue.isError && isEmptyDatabaseError(catalogue.error))) {
    return (
      <main className="container-page flex min-h-dvh flex-col items-center justify-center gap-6 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold">{BRAND_NAME}</h1>
        <SetupCheck />
      </main>
    );
  }

  const list = catalogue.data?.products ?? [];
  const catalogueTotal = catalogue.data?.total ?? 0;
  const empty = emptyCopy[locale];

  return (
    <StoreLayout>
      <HomeHero products={list} />
      <TrustBar acceptsCod={settings?.accepts_cod === true} />

      <section id="catalogue" className="container-page scroll-mt-20 py-12 sm:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-primary sm:text-4xl">
              {t("home.featured")}
            </h2>
          </div>
          {catalogueTotal > 0 && (
            <Link
              to="/catalogue"
              className="inline-flex min-h-9 items-center text-sm font-semibold text-primary hover:underline"
            >
              {t("store.productCount", { count: catalogueTotal })}
            </Link>
          )}
        </div>

        {catalogue.isPending ? (
          <div className="product-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <ProductSkeleton key={index} />
            ))}
          </div>
        ) : catalogue.isError ? (
          <div className="mx-auto flex max-w-xl flex-col gap-4">
            <ErrorState
              message={catalogue.error.message}
              onRetry={() => void catalogue.refetch()}
            />
            <SetupCheck />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title={empty.title}
            body={empty.body}
            icon={<Sparkles size={28} />}
            className="border-outline bg-surface"
          />
        ) : (
          <ProductGrid products={list} />
        )}
      </section>

      <CategoryStrip />
      <StyleDiscovery />
      <ReviewWall />
      <BrandStory />
      <ClosingCta />
    </StoreLayout>
  );
}
