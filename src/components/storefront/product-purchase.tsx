import { useEffect, useState } from "react";
import { Check, MessageCircle, Package } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { formatDzd } from "@/lib/format";
import { MAX_VARIANT_QUANTITY } from "@/lib/order-limits";
import { variantLabel } from "@/lib/product-order";
import { useCart } from "@/lib/cart";
import { useStoreSettings, type CatalogueProduct, type CatalogueVariant } from "@/lib/queries";
import { waLink } from "@/lib/whatsapp";
import { saleOf } from "@/lib/sale";
import { Button } from "@/components/ui/button";

export function StockLine({
  selected,
  hasStock,
}: {
  selected: CatalogueVariant | null;
  hasStock: boolean;
}) {
  const { t, locale } = useI18n();
  const low = selected !== null && selected.stock > 0 && selected.stock <= 3;
  const sale = selected ? saleOf(selected) : null;

  return (
    <div className="flex flex-col gap-2">
      {selected && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1" dir="ltr">
          <span className="font-mono text-2xl font-semibold text-primary">
            {formatDzd(selected.price, locale)}
          </span>
          {sale && (
            <>
              <span className="font-mono text-base text-on-surface-muted line-through">
                {formatDzd(sale.was, locale)}
              </span>
              <span className="rounded-full bg-positive/12 px-2 py-0.5 font-mono text-xs font-semibold text-positive">
                −{sale.percent}%
              </span>
            </>
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {hasStock ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-positive/12 px-3 py-1 text-positive">
            <Check size={14} aria-hidden="true" />
            {t("store.inStock")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-error/12 px-3 py-1 text-error">
            {t("store.outOfStock")}
          </span>
        )}
        {low && selected && (
          <span className="text-xs text-tertiary">
            {t("store.lowStock", { count: selected.stock })}
          </span>
        )}
      </div>
    </div>
  );
}

export function AddToCart({
  product,
  name,
  selected,
  images,
  quantity,
  setQuantity,
}: {
  product: CatalogueProduct;
  name: string;
  selected: CatalogueVariant | null;
  images: string[];
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { t, locale } = useI18n();
  const { add } = useCart();
  const { data: settings } = useStoreSettings();

  const [pageUrl, setPageUrl] = useState("");
  useEffect(() => setPageUrl(window.location.href), []);

  const waHref = waLink(
    settings?.whatsapp,
    [
      t("store.waOrderIntro"),
      `${name}${selected ? ` — ${variantLabel(selected)}` : ""}`,
      `${quantity} × ${formatDzd(selected?.price ?? 0, locale)}`,
      pageUrl,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const handleAdd = () => {
    if (!selected) return;
    add(
      {
        variantId: selected.id,
        productId: product.id,
        slug: product.slug,
        name,
        variantLabel: variantLabel(selected),
        setType: selected.set_type,
        unitPrice: selected.price,
        imageUrl: images[0] ?? null,
      },
      quantity,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="ci-qty !h-11">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label={`${t("common.quantity")} −`}
          >
            −
          </button>
          <span className="q" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() =>
              setQuantity((q) =>
                Math.min(selected?.stock ?? MAX_VARIANT_QUANTITY, MAX_VARIANT_QUANTITY, q + 1),
              )
            }
            aria-label={`${t("common.quantity")} +`}
          >
            +
          </button>
        </span>

        <Button variant="berry" size="lg" onClick={handleAdd} className="flex-1">
          <Package size={18} aria-hidden="true" />
          {t("store.addToCart")}
        </Button>
      </div>

      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-lg btn-block"
        >
          <MessageCircle size={18} aria-hidden="true" />
          {t("store.orderViaWhatsapp")}
        </a>
      )}
    </div>
  );
}
