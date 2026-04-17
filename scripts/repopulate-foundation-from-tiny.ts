import { PrismaClient } from "@prisma/client";

import { importTinyProductBySku } from "@/lib/tiny";
import { reconcileTinySalesOrders } from "@/lib/tiny-sales-events";
import { reconcileVariantInventory } from "@/lib/tiny-stock-events";

type ParsedArgs = {
  skus: string[];
  supplierSlugs: string[];
  actorUsername: string;
  salesDays: number;
  salesMaxPages: number;
  salesMaxOrders: number;
  stockLimit: number;
  skipImports: boolean;
  skipStock: boolean;
  skipSales: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const values = new Map<string, string>();

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value = ""] = raw.slice(2).split("=");
    values.set(key, value);
  }

  const skus = (values.get("skus") ?? "01-2504,01-1195,01-1215,01-1004,01-1089,01-1017")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const supplierSlugs = (values.get("supplier-slugs") ?? "luna-textil,on-shopp")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    skus,
    supplierSlugs,
    actorUsername: values.get("actor")?.trim() || "admin",
    salesDays: Math.min(Math.max(Number(values.get("sales-days") ?? "60"), 1), 180),
    salesMaxPages: Math.min(Math.max(Number(values.get("sales-max-pages") ?? "8"), 1), 50),
    salesMaxOrders: Math.min(Math.max(Number(values.get("sales-max-orders") ?? "600"), 1), 2000),
    stockLimit: Math.min(Math.max(Number(values.get("stock-limit") ?? "800"), 1), 5000),
    skipImports: values.has("skip-imports"),
    skipStock: values.has("skip-stock"),
    skipSales: values.has("skip-sales")
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

async function resolveActorAndSuppliers(parsed: ParsedArgs) {
  const actor = await prisma.user.findFirst({
    where: {
      username: parsed.actorUsername,
      role: "ADMIN",
      active: true
    },
    select: {
      id: true,
      username: true
    }
  });

  if (!actor) {
    throw new Error(`Admin '${parsed.actorUsername}' nao encontrado para a reingestao.`);
  }

  const suppliers = await prisma.supplier.findMany({
    where: {
      slug: {
        in: parsed.supplierSlugs
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
    throw new Error("Nenhum fornecedor ativo encontrado para vincular o catalogo reimportado.");
  }

  return {
    actor,
    suppliers
  };
}

async function summarizeFoundation() {
  const [
    catalogProductCount,
    catalogVariantCount,
    catalogInventoryCount,
    salesOrderCount,
    salesItemCount,
    variantMetricCount,
    productMetricCount,
    supplierMetricCount,
    customerCount,
    tinyWebhookCount,
    syncRunCount
  ] = await Promise.all([
    prisma.catalogProduct.count(),
    prisma.catalogVariant.count(),
    prisma.catalogInventory.count(),
    prisma.salesOrder.count(),
    prisma.salesOrderItem.count(),
    prisma.variantSalesMetricDaily.count(),
    prisma.productSalesMetricDaily.count(),
    prisma.supplierSalesMetricDaily.count(),
    prisma.customer.count(),
    prisma.tinyWebhookLog.count(),
    prisma.syncRun.count()
  ]);

  return {
    catalogProductCount,
    catalogVariantCount,
    catalogInventoryCount,
    salesOrderCount,
    salesItemCount,
    variantMetricCount,
    productMetricCount,
    supplierMetricCount,
    customerCount,
    tinyWebhookCount,
    syncRunCount
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  console.log("[RUN] repopulating foundation from Tiny");
  console.log("[RUN] input", parsed);

  const { actor, suppliers } = await resolveActorAndSuppliers(parsed);
  const supplierIds = suppliers.map((supplier) => supplier.id);

  const importResults: Array<{
    sku: string;
    ok: boolean;
    importedVariants?: number;
    parentSku?: string;
    error?: string;
  }> = [];

  if (parsed.skipImports) {
    console.log("[SKIP] import stage disabled by --skip-imports");
  } else {
    for (const [index, sku] of parsed.skus.entries()) {
      console.log(`[RUN] importing ${sku} (${index + 1}/${parsed.skus.length})`);

      try {
        const result = await importTinyProductBySku({
          sku,
          supplierIds,
          actorUserId: actor.id
        });

        importResults.push({
          sku,
          ok: true,
          importedVariants: result.importedVariants,
          parentSku: result.parentSku
        });
        console.log(`[OK] imported ${sku} -> ${result.parentSku} (${result.importedVariants} variacoes)`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha na importacao.";
        importResults.push({
          sku,
          ok: false,
          error: message
        });
        console.log(`[WARN] import failed for ${sku}: ${message}`);
      }
    }
  }

  const stockResult = parsed.skipStock
    ? { skipped: true }
    : await (async () => {
        console.log("[RUN] reconciling stock");
        return reconcileVariantInventory({
          force: true,
          limit: parsed.stockLimit
        });
      })();

  const salesResult = parsed.skipSales
    ? { skipped: true }
    : await (async () => {
        console.log("[RUN] reconciling sales");
        return reconcileTinySalesOrders({
          days: parsed.salesDays,
          maxPages: parsed.salesMaxPages,
          maxOrders: parsed.salesMaxOrders,
          requestedByUserId: actor.id
        });
      })();

  const summary = await summarizeFoundation();

  console.log(
    JSON.stringify(
      {
        actor: actor.username,
        suppliers: suppliers.map((supplier) => ({ slug: supplier.slug, name: supplier.name })),
        imports: importResults,
        stockResult,
        salesResult,
        summary
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("[FAIL] repopulate-foundation-from-tiny", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
