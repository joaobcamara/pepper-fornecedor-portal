import { AdminShellLayoutClient } from "@/components/admin-shell-layout-client";
import { PepperIaBubbleSlot, type PepperIaBubblePageKey } from "@/components/pepper-ia-bubble-slot";

export function AdminShellV2({
  currentPath,
  title,
  description,
  pepperIaPageKey,
  pepperIaHint,
  pepperIaAlertCount,
  children
}: {
  currentPath: string;
  title: string;
  description: string;
  pepperIaPageKey?: PepperIaBubblePageKey;
  pepperIaHint?: string | null;
  pepperIaAlertCount?: number;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-pepper-glow px-4 py-4 lg:px-6 lg:py-6">
      <AdminShellLayoutClient currentPath={currentPath} title={title} description={description}>
        {children}
      </AdminShellLayoutClient>
      <PepperIaBubbleSlot pageKey={pepperIaPageKey} pageHint={pepperIaHint} alertCount={pepperIaAlertCount} />
    </main>
  );
}
