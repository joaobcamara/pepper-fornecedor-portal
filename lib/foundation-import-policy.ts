export const FOUNDATION_LARGE_FAMILY_VARIANT_THRESHOLD = 40;
export const FOUNDATION_LARGE_FAMILY_IMPORT_CHUNK_SIZE = 12;
export const FOUNDATION_LARGE_FAMILY_IMPORT_TIMEOUT_MS = 90000;

export type FoundationImportMode = "single_pass" | "staged_family";

export type FoundationSkuImportPlan = {
  mode: FoundationImportMode;
  variantCount: number;
  chunkSize: number | null;
  recommendedTimeoutMs: number;
  shouldUseExtendedTimeout: boolean;
  description: string;
};

export function buildFoundationSkuImportPlan(variantCount: number): FoundationSkuImportPlan {
  const normalizedCount = Number.isFinite(variantCount) && variantCount > 0 ? Math.floor(variantCount) : 0;

  if (normalizedCount >= FOUNDATION_LARGE_FAMILY_VARIANT_THRESHOLD) {
    return {
      mode: "staged_family",
      variantCount: normalizedCount,
      chunkSize: FOUNDATION_LARGE_FAMILY_IMPORT_CHUNK_SIZE,
      recommendedTimeoutMs: FOUNDATION_LARGE_FAMILY_IMPORT_TIMEOUT_MS,
      shouldUseExtendedTimeout: true,
      description:
        "Familia grande detectada. A fundacao deve importar por etapas: pai, estrutura, filhas em ondas curtas e estoque por lote."
    };
  }

  return {
    mode: "single_pass",
    variantCount: normalizedCount,
    chunkSize: null,
    recommendedTimeoutMs: FOUNDATION_LARGE_FAMILY_IMPORT_TIMEOUT_MS,
    shouldUseExtendedTimeout: false,
    description: "Familia pequena ou media. A fundacao pode importar em fluxo unico, mantendo reconciliacao normal."
  };
}
