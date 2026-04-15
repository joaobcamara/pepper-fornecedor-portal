import { SupplierTopNav } from "@/components/supplier-top-nav";
import { PepperIaBubbleSlot, type PepperIaBubblePageKey } from "@/components/pepper-ia-bubble-slot";

export function SupplierPageShellV2({
  unreadCount = 0,
  supplierName = "Fornecedor Pepper",
  supplierInitials = "PF",
  supplierLogoUrl = null,
  title,
  description,
  pepperIaPageKey = "generic",
  pepperIaHint = null,
  children
}: {
  unreadCount?: number;
  supplierName?: string;
  supplierInitials?: string;
  supplierLogoUrl?: string | null;
  title: string;
  description: string;
  pepperIaPageKey?: PepperIaBubblePageKey;
  pepperIaHint?: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-pepper-glow px-4 pb-24 pt-4 text-slate-700 sm:px-5 sm:pt-5 md:pb-5 lg:px-8 lg:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <SupplierTopNav
          unreadCount={unreadCount}
          supplierName={supplierName}
          supplierInitials={supplierInitials}
          supplierLogoUrl={supplierLogoUrl}
          showSupplierIdentity
        />

        <section className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-panel backdrop-blur sm:p-6">
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
        </section>

        {children}
      </div>
      <PepperIaBubbleSlot pageKey={pepperIaPageKey} pageHint={pepperIaHint} />
    </main>
  );
}
