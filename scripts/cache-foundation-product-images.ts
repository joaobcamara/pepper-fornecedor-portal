import { cacheRemoteImage } from "@/lib/local-files";
import { prisma } from "@/lib/prisma";

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value] = raw.slice(2).split("=");
    if (value !== undefined) {
      values.set(key, value);
    }
  }

  return {
    sku: values.get("sku")?.trim() || ""
  };
}

async function main() {
  const { sku } = parseArgs(process.argv.slice(2));

  if (!sku) {
    throw new Error("Informe o SKU pai com --sku=01-1215");
  }

  const product = await prisma.catalogProduct.findUnique({
    where: {
      skuParent: sku
    },
    include: {
      images: true,
      variants: {
        include: {
          images: true
        }
      }
    }
  });

  if (!product) {
    throw new Error(`Produto ${sku} nao encontrado na fundacao.`);
  }

  let updated = 0;

  if (product.mainImageUrl && !product.mainImageUrl.startsWith("/")) {
    const cachedMain = await cacheRemoteImage({
      url: product.mainImageUrl,
      folder: "uploads/foundation/catalog",
      prefix: `${sku}-parent`
    });

    if (cachedMain && cachedMain !== product.mainImageUrl) {
      await prisma.catalogProduct.update({
        where: { id: product.id },
        data: {
          mainImageUrl: cachedMain
        }
      });

      if (product.sourceProductId) {
        await prisma.product.update({
          where: { id: product.sourceProductId },
          data: {
            imageUrl: cachedMain
          }
        }).catch(() => null);
      }

      await prisma.catalogImage.updateMany({
        where: {
          catalogProductId: product.id,
          catalogVariantId: null,
          url: product.mainImageUrl
        },
        data: {
          url: cachedMain
        }
      });

      updated += 1;
    }
  }

  for (const variant of product.variants) {
    const currentUrl =
      variant.images.find((image) => image.isPrimary)?.url ??
      variant.images[0]?.url ??
      null;

    if (!currentUrl || currentUrl.startsWith("/")) {
      continue;
    }

    const cachedVariant = await cacheRemoteImage({
      url: currentUrl,
      folder: "uploads/foundation/catalog",
      prefix: variant.sku
    });

    if (cachedVariant && cachedVariant !== currentUrl) {
      await prisma.catalogImage.updateMany({
        where: {
          catalogVariantId: variant.id,
          url: currentUrl
        },
        data: {
          url: cachedVariant
        }
      });

      if (variant.sourceProductId) {
        await prisma.product.update({
          where: { id: variant.sourceProductId },
          data: {
            imageUrl: cachedVariant
          }
        }).catch(() => null);
      }

      updated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        sku,
        updated
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("[FAIL] cache-foundation-product-images", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
