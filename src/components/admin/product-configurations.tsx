import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminProduct } from "@/lib/admin-products";
import { ColourPhotos } from "./colour-photos";
import { ProductPhotos } from "./product-photos";
import { VariantEditor } from "./variant-editor";
export function ProductConfigurations({
  id,
  product,
  hasColours,
}: {
  id: string;
  product: AdminProduct;
  hasColours: boolean;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Configurations de vente</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-muted">
            Une configuration correspond à une combinaison vendable : tissu, type de parure, nombre
            de pièces, dimension du matelas, prix et stock.
          </p>
          <VariantEditor productId={id} variants={product.product_variants} />
        </CardBody>
      </Card>

      {product.product_variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Photos et couleurs</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <ColourPhotos productId={id} variants={product.product_variants} />

            {!hasColours && (
              <div className="border-t border-outline pt-5">
                <ProductPhotos productId={id} variants={product.product_variants} />
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}
