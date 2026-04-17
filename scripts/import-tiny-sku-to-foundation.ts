import { PrismaClient } from "@prisma/client";

import { importTinyProductBySku } from "@/lib/tiny";

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value = ""] = raw.slice(2).split("=");
    values.set(key, value);
  }

  return {
    sku: values.get("sku")?.trim() || "",
    actorUsername: values.get("actor")?.trim() || "admin",
    supplierSlugs: (values.get("supplier-slugs") ?? "luna-textil,on-shopp")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = datasourceUrl
  ? new PrismaClient({
      datasources: {
        db: {
          url: datasourceUrl
        }
      }
    })
  : new PrismaClient();

async function main() {
  const { sku, actorUsername, supplierSlugs } = parseArgs(process.argv.slice(2));

  if (!sku) {
    throw new Error("Informe o SKU com --sku=01-1041");
  }

  const actor = await prisma.user.findFirst({
    where: {
      username: actorUsername,
      role: "ADMIN",
      active: true
    },
    select: {
      id: true,
      username: true
    }
  });

  if (!actor) {
    throw new Error(`Admin '${actorUsername}' nao encontrado.`);
  }

  const suppliers = await prisma.supplier.findMany({
    where: {
      slug: {
        in: supplierSlugs
      },
      active: true
    },
    select: {
      id: true,
      name: true,
      slug: true
    },
    orderBy: {
      slug: "asc"
    }
  });

  if (suppliers.length === 0) {
    throw new Error("Nenhum fornecedor ativo encontrado para vincular o SKU importado.");
  }

  console.log(`[RUN] importing Tiny SKU ${sku} into foundation`);
  const result = await importTinyProductBySku({
    sku,
    supplierIds: suppliers.map((supplier) => supplier.id),
    actorUserId: actor.id
  });

  const catalogProduct = await prisma.catalogProduct.findFirst({
    where: {
      skuParent: result.parentSku
    },
    select: {
      id: true,
      skuParent: true,
      name: true,
      variants: {
        orderBy: {
          sku: "asc"
        },
        select: {
          id: true,
          sku: true,
          sizeCode: true,
          colorCode: true,
          colorLabel: true,
          inventory: {
            select: {
              availableMultiCompanyStock: true,
              inventorySyncStatus: true,
              lastStockSyncAt: true
            }
          }
        }
      },
      supplierLinks: {
        include: {
          supplier: {
            select: {
              slug: true,
              name: true
            }
          }
        }
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        actor: actor.username,
        suppliers: suppliers.map((supplier) => ({
          slug: supplier.slug,
          name: supplier.name
        })),
        importResult: result,
        importPlan: result.importPlan ?? null,
        catalogProduct: catalogProduct
          ? {
              id: catalogProduct.id,
              skuParent: catalogProduct.skuParent,
              name: catalogProduct.name,
              variantCount: catalogProduct.variants.length,
              variants: catalogProduct.variants.map((variant) => ({
                id: variant.id,
                sku: variant.sku,
                sizeCode: variant.sizeCode,
                colorCode: variant.colorCode,
                colorLabel: variant.colorLabel,
                inventory: variant.inventory
              })),
              linkedSuppliers: catalogProduct.supplierLinks.map((entry) => entry.supplier)
            }
          : null
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("[FAIL] import-tiny-sku-to-foundation", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
