export type StockBand = "critical" | "low" | "ok" | "unknown";

export const DEFAULT_STOCK_THRESHOLDS = {
  critical: 0,
  low: 5
} as const;

export type StockThresholds = {
  critical: number;
  low: number;
};

export function resolveStockThresholds(params?: {
  productCritical?: number | null;
  productLow?: number | null;
  parentCritical?: number | null;
  parentLow?: number | null;
}): StockThresholds {
  const critical = params?.productCritical ?? params?.parentCritical ?? DEFAULT_STOCK_THRESHOLDS.critical;
  const low = params?.productLow ?? params?.parentLow ?? DEFAULT_STOCK_THRESHOLDS.low;

  return {
    critical,
    low: Math.max(low, critical)
  };
}

export function getStockBand(
  quantity: number | null | undefined,
  thresholds: StockThresholds = DEFAULT_STOCK_THRESHOLDS
): StockBand {
  if (quantity === null || quantity === undefined) {
    return "unknown";
  }

  if (quantity <= thresholds.critical) {
    return "critical";
  }

  if (quantity <= thresholds.low) {
    return "low";
  }

  return "ok";
}

export function getStockBandLabel(band: StockBand) {
  switch (band) {
    case "critical":
      return "Crítico";
    case "low":
      return "Baixo";
    case "ok":
      return "Saudável";
    default:
      return "Não importado";
  }
}
