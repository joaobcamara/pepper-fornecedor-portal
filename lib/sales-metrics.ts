export function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

export function getDateWindows(now = new Date()) {
  const today = startOfDay(now);

  return {
    today,
    tomorrow: addDays(today, 1),
    sevenDaysAgo: addDays(today, -6),
    thirtyDaysAgo: addDays(today, -29),
    ninetyDaysAgo: addDays(today, -89),
    oneEightyDaysAgo: addDays(today, -179),
    oneYearAgo: addDays(today, -364)
  };
}

export type SalesPeriodKey = "1d" | "7d" | "1m" | "3m" | "6m" | "1a";

export const SALES_PERIOD_OPTIONS: Array<{ key: SalesPeriodKey; label: string }> = [
  { key: "1d", label: "1D" },
  { key: "7d", label: "7D" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1a", label: "1A" }
];

export type SalesPeriodTotals = Record<SalesPeriodKey, number>;

export const EMPTY_SALES_PERIOD_TOTALS: SalesPeriodTotals = {
  "1d": 0,
  "7d": 0,
  "1m": 0,
  "3m": 0,
  "6m": 0,
  "1a": 0
};

export function buildSalesPeriodTotals<T extends { date: Date; unitsSold: number }>(
  metrics: T[],
  now = new Date()
): SalesPeriodTotals {
  const windows = getDateWindows(now);

  return {
    "1d": Number(sumNumbers(metrics.filter((metric) => metric.date >= windows.today && metric.date < windows.tomorrow).map((metric) => metric.unitsSold))),
    "7d": Number(sumNumbers(metrics.filter((metric) => metric.date >= windows.sevenDaysAgo).map((metric) => metric.unitsSold))),
    "1m": Number(sumNumbers(metrics.filter((metric) => metric.date >= windows.thirtyDaysAgo).map((metric) => metric.unitsSold))),
    "3m": Number(sumNumbers(metrics.filter((metric) => metric.date >= windows.ninetyDaysAgo).map((metric) => metric.unitsSold))),
    "6m": Number(sumNumbers(metrics.filter((metric) => metric.date >= windows.oneEightyDaysAgo).map((metric) => metric.unitsSold))),
    "1a": Number(sumNumbers(metrics.filter((metric) => metric.date >= windows.oneYearAgo).map((metric) => metric.unitsSold)))
  };
}

export function sumNumbers(values: Array<number | null | undefined>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function safeCoverageDays(stock: number, sales30d: number) {
  if (stock <= 0) {
    return 0;
  }

  if (sales30d <= 0) {
    return null;
  }

  const dailyAverage = sales30d / 30;
  if (dailyAverage <= 0) {
    return null;
  }

  return Math.round((stock / dailyAverage) * 10) / 10;
}

export function getMovementBadge(params: {
  sales7d: number;
  sales30d: number;
  coverageDays: number | null;
  stockBand: "critical" | "low" | "ok" | "unknown";
}) {
  if (params.stockBand === "critical" || params.coverageDays === 0) {
    return "Reposicao urgente";
  }

  if (params.sales7d >= 10 || params.sales30d >= 25) {
    return "Alto giro";
  }

  if (params.sales30d === 0) {
    return "Sem venda";
  }

  if (params.coverageDays !== null && params.coverageDays <= 15) {
    return "Atencao reposicao";
  }

  return "Estavel";
}
