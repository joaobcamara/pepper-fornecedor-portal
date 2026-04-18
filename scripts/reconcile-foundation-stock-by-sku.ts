import { PrismaClient } from "@prisma/client";

import { reconcileFoundationStockBySku } from "@/lib/foundation-stock-reconcile";

type Args = {
  sku: string;
  batchSize: number;
  pauseMs: number;
};

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

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value = ""] = raw.slice(2).split("=");
    values.set(key, value);
  }

  return {
    sku: values.get("sku")?.trim() || "",
    batchSize: Math.max(1, Number.parseInt(values.get("batch-size") ?? "10", 10) || 10),
    pauseMs: Math.max(0, Number.parseInt(values.get("pause-ms") ?? "1500", 10) || 1500)
  };
}

async function main() {
  const { sku, batchSize, pauseMs } = parseArgs(process.argv.slice(2));

  if (!sku) {
    throw new Error("Informe o SKU com --sku=01-1215 ou --sku=01-1215-24-02");
  }

  const variants = await prisma.catalogVariant.count({
    where: {
      OR: [{ sku }, { catalogProduct: { skuParent: sku } }]
    }
  });
  console.log(
    `[RUN] reconciliando ${variants} variacoes em ondas de ${batchSize} com pausa de ${pauseMs}ms entre lotes`
  );

  const result = await reconcileFoundationStockBySku({
    prisma,
    sku,
    batchSize,
    pauseMs
  });

  console.table(result.rows);
  console.log(
    JSON.stringify(
      {
        authoritativeAccountKey: result.authoritativeAccountKey,
        sku: result.sku,
        reconciled: result.reconciled,
        failed: result.failed
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("[FAIL] reconcile-foundation-stock-by-sku", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
