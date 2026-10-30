import { Link, createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { StoreLayout } from "@/components/storefront/store-layout";
import { ProductGrid } from "@/components/storefront/product-card";
import { HomeHero, TrustBar } from "@/components/storefront/home-hero";
import {
  BrandStory,
  CategoryStrip,
  ClosingCta,
  ReviewWall,
  StyleDiscovery,
} from "@/components/storefront/home-sections";
import { EmptyState, ErrorState, ProductSkeleton } from "@/components/ui/feedback";
import { SetupCheck } from "@/components/setup-check";
import { isEmptyDatabaseError } from "@/lib/supabase/health";
import { supabaseConfigProblem } from "@/lib/supabase/client";
import { reviewsQuery, storeSettingsQuery } from "@/lib/queries";
import { EMPTY_FILTERS, cataloguePageQuery, useCataloguePage } from "@/lib/catalogue";
import { useI18n } from "@/lib/i18n-context";

const emptyCopy = {
  fr: {
    title: "La collection Elegancia arrive bientôt.",
    body: "Les premiers modèles sont en préparation. Revenez bientôt pour découvrir les parures disponibles.",
  },
  en: {
    title: "The Elegancia collection is coming soon.",
    body: "Our first designs are being prepared. Come back soon to discover the available bedding sets.",
  },
  ar: {
    title: "مجموعة Elegancia قادمة قريباً.",
    body: "نحضّر أول الموديلات بعناية. عودي قريباً لاكتشاف الأطقم المتوفرة.",
  },
} as const;

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const settings = await context.queryClient
      .ensureQueryData(storeSettingsQuery())
      .catch(() => null);
    await Promise.all([
      context.queryClient.ensureQueryData(reviewsQuery()).catch(() => null),
      context.queryClient.ensureQueryData(cataloguePageQuery(EMPTY_FILTERS, 1)).catch(() => null),
    ]);
    return { settings };
  },
  head: ({ loaderData, match }) => {
    const s = loaderData?.settings;
    const ar = match.context.locale === "ar";
    const name = s?.name?.trim();
    const tagline = (ar ? s?.tagline : s?.tagline_fr)?.trim();
    const title = name ? `${name}${tagline ? ` — ${tagline}` : ""}` : "Elegancia Home";
    const description =
      (ar ? s?.description : s?.description_fr)?.trim() ||
      (ar
        ? "مفروشات وبياضات منزلية أنيقة مع الدفع عند الاستلام."
        : "Literie et linge de maison élégants avec paiement à la livraison.");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
      ],
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
        <h1 className="font-display text-3xl font-semibold">{settings?.name ?? "Elegancia Home"}</h1>
        <SetupCheck />
      </main>
    );
  }

  const list = catalogue.data?.products ?? [];
  const catalogueTotal = catalogue.data?.total ?? 0;
  const empty = emptyCopy[locale];

  return (
    <StoreLayout>
      <HomeHero settings={settings} products={list} />
      <StyleDiscovery />

      <section id="catalogue" className="container-page scroll-mt-20 py-12 sm:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="section-label">{t("home.featured")}</span>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-[#38281E] sm:text-3xl">
              {t("nav.shop")}
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
            className="border-[#DFD1C5] bg-[#FFFDF9]"
          />
        ) : (
          <ProductGrid products={list} />
        )}
      </section>

      <CategoryStrip />
      <BrandStory />
      <TrustBar />
      <ReviewWall />
      <ClosingCta storeName={settings?.name ?? "Elegancia Home"} />
    </StoreLayout>
  );
}
