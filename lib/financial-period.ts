export const FINANCIAL_PERIOD_OPTIONS = [
  { key: "15d", label: "15 dias", days: 15 },
  { key: "1m", label: "1 mes", days: 30 },
  { key: "3m", label: "3 meses", days: 90 },
  { key: "6m", label: "6 meses", days: 180 },
  { key: "1a", label: "1 ano", days: 365 }
] as const;

export type FinancialPeriodKey = (typeof FINANCIAL_PERIOD_OPTIONS)[number]["key"];

export function parseFinancialPeriod(value?: string | null): FinancialPeriodKey {
  if (FINANCIAL_PERIOD_OPTIONS.some((option) => option.key === value)) {
    return value as FinancialPeriodKey;
  }

  return "1m";
}

export function getFinancialPeriodMeta(period: FinancialPeriodKey, now = new Date()) {
  const option = FINANCIAL_PERIOD_OPTIONS.find((entry) => entry.key === period) ?? FINANCIAL_PERIOD_OPTIONS[1];
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (option.days - 1));

  return {
    ...option,
    startDate,
    endDate
  };
}
