import { BRAND_HORIZONTAL, BRAND_MONOGRAM, BRAND_NAME } from "@/lib/brand";

export function BrandSignature() {
  return (
    <span className="inline-flex min-w-0 items-center rounded-sm bg-ivory px-2 py-1">
      <img
        src={BRAND_HORIZONTAL}
        alt={BRAND_NAME}
        width="144"
        height="49"
        className="brand-signature-full h-auto w-30 max-w-full sm:w-36"
      />
      <img
        src={BRAND_MONOGRAM}
        alt={BRAND_NAME}
        width="29"
        height="24"
        className="brand-signature-small hidden"
      />
    </span>
  );
}
