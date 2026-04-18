import { hydrateFoundationCatalogBySku } from "@/lib/foundation-catalog-hydration";

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value] = raw.slice(2).split("=");

    if (value === undefined) {
      flags.add(key);
      continue;
    }

    values.set(key, value);
  }

  return {
    sku: values.get("sku")?.trim() || "",
    force: flags.has("force")
  };
}

async function main() {
  const { sku, force } = parseArgs(process.argv.slice(2));

  if (!sku) {
    throw new Error("Informe o SKU com --sku=01-1041");
  }

  console.log(`[RUN] hydrating foundation catalog for ${sku}`);
  const result = await hydrateFoundationCatalogBySku({
    sku,
    triggerType: "manual_catalog_hydration",
    reason: "ensure_media",
    force
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[FAIL] hydrate-foundation-catalog", error);
  process.exitCode = 1;
});
