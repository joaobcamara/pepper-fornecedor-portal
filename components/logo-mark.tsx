import Image from "next/image";
import { cn } from "@/lib/cn";

type LogoMarkProps = {
  className?: string;
  compact?: boolean;
};

export function LogoMark({ className, compact = false }: LogoMarkProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-3xl border border-white/70 bg-white/80 shadow-soft backdrop-blur",
        compact ? "justify-center p-2.5" : "px-4 py-2.5",
        className
      )}
    >
      <div className="relative h-9 w-9 overflow-hidden rounded-2xl bg-[#ffefcf]">
        <Image src="/brand/pepper-logo.png" alt="Pepper Atacadista" fill className="object-contain p-1" />
      </div>
      {compact ? null : (
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-slate-400">PEPPER E-COMMERCE</p>
          <p className="text-sm font-semibold text-slate-800">Portal do Fornecedor</p>
        </div>
      )}
    </div>
  );
}
