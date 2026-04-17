import { safeCoverageDays } from "@/lib/sales-metrics";

export type PurchaseSuggestionConfidence = "high" | "medium" | "low";
export type PurchaseSuggestionBasis =
  | "dynamic_7_15_30"
  | "sales_30d"
  | "projected_7d"
  | "projected_1d"
  | "threshold_only";

export type PurchaseSuggestionResult = {
  suggestedQuantity: number;
  currentStock: number;
  targetStock: number;
  recentDemand: number;
  coverageDays: number | null;
  confidence: PurchaseSuggestionConfidence;
  confidenceLabel: string;
  basis: PurchaseSuggestionBasis;
  basisLabel: string;
  explanation: string;
  usedSalesHistory: boolean;
};

export type PurchaseSuggestionSummary = {
  confidence: PurchaseSuggestionConfidence;
  confidenceLabel: string;
  tone: "success" | "warning";
  readinessMessage: string;
  appliedMessage: string;
  historyBackedCount: number;
  thresholdOnlyCount: number;
};

export function suggestPurchaseQuantity(params: {
  currentStock: number | null | undefined;
  sales1d?: number | null;
  sales7d?: number | null;
  sales15d?: number | null;
  sales30d?: number | null;
  criticalStockThreshold?: number | null;
  lowStockThreshold?: number | null;
}): PurchaseSuggestionResult {
  const currentStock = Math.max(0, params.currentStock ?? 0);
  const sales1d = Math.max(0, params.sales1d ?? 0);
  const sales7d = Math.max(0, params.sales7d ?? 0);
  const sales15d = Math.max(0, params.sales15d ?? 0);
  const sales30d = Math.max(0, params.sales30d ?? 0);
  const critical = Math.max(0, params.criticalStockThreshold ?? 0);
  const low = Math.max(critical, params.lowStockThreshold ?? 0);

  let basis: PurchaseSuggestionBasis = "threshold_only";
  let recentDemand = 0;

  const sales7dDaily = sales7d > 0 ? sales7d / 7 : 0;
  const sales15dDaily = sales15d > 0 ? sales15d / 15 : 0;
  const sales30dDaily = sales30d > 0 ? sales30d / 30 : 0;

  if (sales30d > 0 && sales15d > 0 && sales7d > 0) {
    basis = "dynamic_7_15_30";

    const weightedDailyDemand = sales7dDaily * 0.5 + sales15dDaily * 0.3 + sales30dDaily * 0.2;
    const accelerating =
      sales7dDaily >= sales15dDaily * 1.12 || sales15dDaily >= sales30dDaily * 1.08;
    const decelerating =
      sales7dDaily <= sales15dDaily * 0.88 && sales15dDaily <= sales30dDaily * 0.92;

    const trendFactor = accelerating ? 1.12 : decelerating ? 0.92 : 1;
    recentDemand = Math.ceil(weightedDailyDemand * 30 * trendFactor);
  } else if (sales30d > 0) {
    basis = "sales_30d";
    recentDemand = sales30d;
  } else if (sales7d > 0) {
    basis = "projected_7d";
    recentDemand = Math.ceil(sales7d * 4.3);
  } else if (sales1d > 0) {
    basis = "projected_1d";
    recentDemand = sales1d * 15;
  }

  const minimumTarget = Math.max(low * 2, critical + 2);
  const targetStock = Math.max(recentDemand, minimumTarget);
  const suggestedQuantity = Math.max(0, Math.ceil(targetStock - currentStock));
  const confidence: PurchaseSuggestionConfidence =
    basis === "dynamic_7_15_30"
      ? "high"
      : basis === "sales_30d"
        ? (sales30d >= 8 ? "high" : "medium")
        : basis === "projected_7d"
          ? "medium"
          : "low";
  const confidenceLabel =
    confidence === "high" ? "Alta confianca" : confidence === "medium" ? "Confianca moderada" : "Confianca conservadora";
  const basisLabel =
    basis === "dynamic_7_15_30"
      ? "Leitura dinamica de 7, 15 e 30 dias"
      : basis === "sales_30d"
      ? "Vendas reais dos ultimos 30 dias"
      : basis === "projected_7d"
        ? "Projecao dos ultimos 7 dias"
        : basis === "projected_1d"
          ? "Projecao do ultimo dia"
          : "Estoque critico e cobertura minima";
  const explanation =
    basis === "threshold_only"
      ? "A fundacao ainda nao tem vendas suficientes para este SKU; a sugestao usou estoque critico e cobertura minima."
      : basis === "dynamic_7_15_30"
        ? "A sugestao percebeu a aceleracao ou desaceleracao do giro combinando os ritmos de 7, 15 e 30 dias."
      : basis === "projected_1d"
        ? "A fundacao ainda tem base curta para este SKU; a sugestao extrapolou o giro mais recente com margem conservadora."
        : basis === "projected_7d"
          ? "A sugestao combinou o saldo atual com a projecao recente da fundacao."
          : "A sugestao usou historico consistente de 30 dias da fundacao e o saldo atual.";

  return {
    suggestedQuantity,
    currentStock,
    targetStock,
    recentDemand,
    coverageDays: safeCoverageDays(currentStock, sales30d),
    confidence,
    confidenceLabel,
    basis,
    basisLabel,
    explanation,
    usedSalesHistory: basis !== "threshold_only"
  };
}

export function summarizePurchaseSuggestions(results: PurchaseSuggestionResult[]): PurchaseSuggestionSummary {
  const historyBackedCount = results.filter((result) => result.usedSalesHistory).length;
  const thresholdOnlyCount = results.filter((result) => result.basis === "threshold_only").length;
  const hasHigh = results.some((result) => result.confidence === "high");
  const hasMedium = results.some((result) => result.confidence === "medium");
  const confidence: PurchaseSuggestionConfidence = hasHigh ? "high" : hasMedium ? "medium" : "low";
  const confidenceLabel =
    confidence === "high" ? "Alta confianca" : confidence === "medium" ? "Confianca moderada" : "Confianca conservadora";

  if (thresholdOnlyCount === results.length) {
    return {
      confidence: "low",
      confidenceLabel: "Confianca conservadora",
      tone: "warning",
      readinessMessage:
        "A fundacao ainda nao tem vendas suficientes para este produto. A Pepper IA vai sugerir pela cobertura minima e pelo estoque critico, sem fingir historico de 30 dias.",
      appliedMessage:
        "Pepper IA montou a grade usando estoque critico e cobertura minima porque a fundacao ainda nao tem vendas suficientes nos ultimos 30 dias para este produto.",
      historyBackedCount,
      thresholdOnlyCount
    };
  }

  if (thresholdOnlyCount > 0) {
    return {
      confidence: "medium",
      confidenceLabel: "Confianca moderada",
      tone: "warning",
      readinessMessage:
        "A fundacao ja tem parte do historico deste produto, mas algumas variacoes ainda estao rasas. A Pepper IA vai combinar vendas reais com fallback conservador onde faltar base.",
      appliedMessage:
        "Pepper IA combinou historico real da fundacao com fallback conservador nas variacoes que ainda nao possuem base suficiente de vendas.",
      historyBackedCount,
      thresholdOnlyCount
    };
  }

  return {
    confidence,
    confidenceLabel,
    tone: "success",
    readinessMessage:
      "A fundacao ja tem historico suficiente para este produto. A Pepper IA vai priorizar vendas reais e saldo atual para sugerir a grade.",
    appliedMessage:
      "Pepper IA sugeriu as quantidades com base no historico real da fundacao e no saldo atual deste produto.",
    historyBackedCount,
    thresholdOnlyCount
  };
}
