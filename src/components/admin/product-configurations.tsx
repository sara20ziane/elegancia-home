import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminProduct } from "@/lib/admin-products";
import { BeddingGeneration } from "./bedding-generation";
import { CommonVariantFields } from "./common-variant-fields";
import { CatalogPresets } from "./catalog-presets";
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
          <details>
            <summary className="cursor-pointer font-medium">
              Mode rapide — ajouter plusieurs tailles
            </summary>
            <BeddingGeneration
              modelName={product.name_fr || product.slug}
              productId={id}
              existingVariants={product.product_variants}
            />
          </details>
          <CatalogPresets />
          <CommonVariantFields productId={id} variants={product.product_variants} />
          <details>
            <summary className="cursor-pointer font-medium">
              Réglages avancés — modifier les configurations
            </summary>
            <VariantEditor productId={id} variants={product.product_variants} />
          </details>
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
