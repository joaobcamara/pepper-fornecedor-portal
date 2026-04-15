import { cn } from "@/lib/cn";
import type { StockBand } from "@/lib/stock";

const styles: Record<StockBand, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  low: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  unknown: "border-slate-200 bg-slate-50 text-slate-600"
};

export function StatusPill({ band, label }: { band: StockBand; label: string }) {
  return <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", styles[band])}>{label}</span>;
}
