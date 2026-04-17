import { inspectTinyProductBySku } from "@/lib/tiny";

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value = ""] = raw.slice(2).split("=");
    values.set(key, value);
  }

  return {
    sku: values.get("sku")?.trim() || ""
  };
}

async function main() {
  const { sku } = parseArgs(process.argv.slice(2));

  if (!sku) {
    throw new Error("Informe o SKU com --sku=01-1041");
  }

  console.log(`[RUN] inspecting Tiny SKU ${sku}`);
  const inspection = await inspectTinyProductBySku(sku);

  console.log(
    JSON.stringify(
      {
        searchedSku: inspection.searchedSku,
        source: inspection.source,
        sourceAccountKey: inspection.sourceAccountKey,
        sourceAccountLabel: inspection.sourceAccountLabel,
        parent: inspection.parent,
        variantCount: inspection.variants.length,
        variants: inspection.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          quantity: variant.quantity,
          stockStatus: variant.stockStatus,
          sizeCode: variant.sizeCode ?? null,
          colorCode: variant.colorCode ?? null
        })),
        suggestions: inspection.suggestions.map((suggestion) => ({
          id: suggestion.id,
          sku: suggestion.sku,
          name: suggestion.name,
          variationType: suggestion.variationType,
          accountKey: suggestion.accountKey
        }))
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[FAIL] inspect-tiny-sku", error);
  process.exitCode = 1;
});
