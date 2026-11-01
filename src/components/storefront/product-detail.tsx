import { useState } from "react";
import { Banknote, ShieldCheck, Truck } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { averageRating, sortVariants, useReviews, type CatalogueProduct } from "@/lib/queries";
import {
  colourOptions,
  findVariant,
  imagesForColour,
  initialChoice,
  sizeAfterColourChange,
  sizeOptions,
} from "@/lib/variant-options";
import {
  beddingChoiceForVariant,
  chooseBeddingVariant,
  findBeddingVariant,
  initialBeddingChoice,
  isBeddingProduct,
  type BeddingChoice,
} from "@/lib/bedding-variant-options";
import { QuickOrder } from "./quick-order";
import { StarRating } from "./star-rating";
import { ProductGallery } from "./product-gallery";
import { AddToCart, StockLine } from "./product-purchase";
import { localized } from "@/lib/i18n";
import { ColourPicker, SizePicker } from "./variant-picker";
import { BeddingVariantDetails, BeddingVariantPicker } from "./bedding-variant-picker";

const reassuranceCopy = {
  fr: ["Paiement à la livraison", "Livraison en Algérie", "Commande suivie"],
  en: ["Cash on delivery", "Delivery in Algeria", "Order tracking"],
  ar: ["الدفع عند الاستلام", "التوصيل في الجزائر", "تتبع الطلب"],
} as const;

/**
 * Product page layout.
 *
 * Elegancia products use bedding-specific choices. The original colour/size
 * controls remain as a fallback for any legacy OpenStore product.
 */
export function ProductDetail({ product }: { product: CatalogueProduct }) {
  const { t, locale } = useI18n();
  const { data: reviews } = useReviews(product.id);

  const variants = sortVariants(product.product_variants);
  const stockable = variants.filter((variant) => variant.stock > 0);
  const bedding = isBeddingProduct(variants);

  const [legacyChoice, setLegacyChoice] = useState(() => initialChoice(variants));
  const [beddingChoice, setBeddingChoice] = useState(() => initialBeddingChoice(variants));
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const colours = colourOptions(variants);
  const sizes = sizeOptions(variants, colours.length > 0 ? legacyChoice.colour : null);

  const selected = bedding
    ? findBeddingVariant(variants, beddingChoice)
    : findVariant(variants, legacyChoice.colour, legacyChoice.size);

  const selectedColourImages = imagesForColour(variants, legacyChoice.colour);
  const beddingColourImages = imagesForColour(variants, beddingChoice.colour);
  const images = bedding
    ? beddingColourImages.length > 0
      ? beddingColourImages
      : imagesForColour(variants, null)
    : selectedColourImages.length > 0
      ? selectedColourImages
      : imagesForColour(variants, null);

  const pickColour = (colour: string) => {
    setLegacyChoice({
      colour,
      size: sizeAfterColourChange(variants, colour, legacyChoice.size),
    });
    setActiveImage(0);
    setQuantity(1);
  };

  const pickSize = (size: string) => {
    setLegacyChoice((current) => ({ ...current, size }));
    setQuantity(1);
  };

  const pickBedding = (filter: Partial<BeddingChoice>) => {
    const next = chooseBeddingVariant(variants, filter);
    if (!next) return;
    setBeddingChoice(beddingChoiceForVariant(next));
    setActiveImage(0);
    setQuantity(1);
  };

  const rating = reviews ? averageRating(reviews) : null;
  const description = product.description
    ? localized(locale, product.description, product.description_fr)
    : product.description_fr;
  const name = localized(locale, product.name, product.name_fr);
  const galleryAlt = bedding
    ? [name, beddingChoice.colour, beddingChoice.fabric, beddingChoice.setType]
        .filter(Boolean)
        .join(" — ")
    : legacyChoice.colour
      ? `${name} — ${legacyChoice.colour}`
      : name;
  const reassurance = reassuranceCopy[locale];
  const reassuranceIcons = [Banknote, Truck, ShieldCheck] as const;

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <ProductGallery
        images={images}
        alt={galleryAlt}
        active={activeImage}
        onSelect={setActiveImage}
      />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">{name}</h1>
          {reviews && reviews.length > 0 && (
            <span className="flex items-center gap-2">
              <StarRating value={rating ?? 0} />
              <span className="text-sm text-on-surface-muted">
                {t("reviews.count", { count: reviews.length })}
              </span>
            </span>
          )}
        </div>

        <StockLine selected={selected} hasStock={(selected?.stock ?? 0) > 0} />

        {bedding ? (
          <>
            <BeddingVariantPicker
              variants={variants}
              choice={beddingChoice}
              onChoose={pickBedding}
            />
            <BeddingVariantDetails variant={selected} />
          </>
        ) : (
          <>
            <ColourPicker colours={colours} selected={legacyChoice.colour} onSelect={pickColour} />
            <SizePicker sizes={sizes} selected={legacyChoice.size} onSelect={pickSize} />
          </>
        )}

        {stockable.length > 0 && selected && selected.stock > 0 && (
          <AddToCart
            product={product}
            name={name}
            selected={selected}
            images={images}
            quantity={quantity}
            setQuantity={setQuantity}
          />
        )}

        {selected && selected.stock > 0 && (
          <QuickOrder
            product={product}
            name={name}
            selected={selected}
            images={images}
            quantity={quantity}
          />
        )}

        <div className="grid grid-cols-3 gap-2 border-t border-outline pt-5">
          {reassurance.map((label, index) => {
            const Icon = reassuranceIcons[index];
            return (
              <div
                key={label}
                className="flex min-w-0 flex-col items-center gap-2 rounded-[12px] bg-surface-mid px-2 py-3 text-center"
              >
                <Icon size={17} className="text-primary" aria-hidden="true" />
                <span className="text-[0.68rem] font-medium leading-4 text-on-surface-muted sm:text-xs">
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {description && (
          <div className="flex flex-col gap-2 border-t border-outline pt-5">
            <h2 className="font-display text-base font-semibold">{t("store.description")}</h2>
            <p className="whitespace-pre-line text-sm text-on-surface-muted">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
