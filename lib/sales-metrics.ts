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
    thirtyDaysAgo: addDays(today, -29)
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
