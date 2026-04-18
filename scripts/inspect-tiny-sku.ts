import { callTiny, inspectTinyProductBySku, unwrapTinyItem, type TinyAccountKey } from "@/lib/tiny";

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
    rawImages: flags.has("raw-images")
  };
}

type ImageFieldMatch = {
  path: string;
  value: unknown;
};

function summarizeImageFields(value: unknown, path = "root", seen = new Set<unknown>()): ImageFieldMatch[] {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return [];
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => summarizeImageFields(entry, `${path}[${index}]`, seen));
  }

  const record = value as Record<string, unknown>;
  const matches: ImageFieldMatch[] = [];

  for (const [key, entry] of Object.entries(record)) {
    if (/imagem|image|foto|anexo|arquivo|url/i.test(key)) {
      matches.push({
        path: `${path}.${key}`,
        value: entry
      });
    }

    if (entry && typeof entry === "object") {
      matches.push(...summarizeImageFields(entry, `${path}.${key}`, seen));
    }
  }

  return matches;
}

async function main() {
  const { sku, rawImages } = parseArgs(process.argv.slice(2));

  if (!sku) {
    throw new Error("Informe o SKU com --sku=01-1041");
  }

  console.log(`[RUN] inspecting Tiny SKU ${sku}`);
  const inspection = await inspectTinyProductBySku(sku);
  const tinyAccountKey: TinyAccountKey =
    inspection.sourceAccountKey === "foundation" || inspection.sourceAccountKey === "foundation-local"
      ? "pepper"
      : inspection.sourceAccountKey;
  const rawParent =
    rawImages && inspection.parent.id
      ? unwrapTinyItem((await callTiny("produto.obter.php", { id: inspection.parent.id }, tinyAccountKey)).retorno?.produto)
      : null;

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
        })),
        ...(rawImages
          ? {
              rawImageFields: {
                parent: summarizeImageFields(rawParent ?? inspection.parent),
                variants: inspection.variants
                  .slice(0, 3)
                  .map((variant) => ({
                    sku: variant.sku,
                    imageUrl: variant.imageUrl ?? null,
                    matches: summarizeImageFields(variant.raw)
                  }))
              }
            }
          : {})
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
