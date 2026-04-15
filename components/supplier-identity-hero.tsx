"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

export function SupplierIdentityHero({
  supplierName,
  supplierInitials,
  supplierLogoUrl = null,
  className
}: {
  supplierName: string;
  supplierInitials: string;
  supplierLogoUrl?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex w-fit items-center gap-3 rounded-3xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-soft backdrop-blur", className)}>
      {supplierLogoUrl ? (
        <div className="relative h-9 w-9 overflow-hidden rounded-2xl bg-[#ffefcf]">
          <Image src={supplierLogoUrl} alt={supplierName} fill className="object-contain p-1.5" />
        </div>
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ec6232_0%,#f7b38f_100%)] text-sm font-bold text-white">
          {supplierInitials}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{supplierName}</p>
      </div>
    </div>
  );
}
