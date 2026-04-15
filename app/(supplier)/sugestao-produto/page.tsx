import { redirect } from "next/navigation";
import { SupplierPageShellV2 as SupplierPageShell } from "@/components/supplier-page-shell-v2";
import { SupplierSuggestionForm } from "@/components/supplier-suggestion-form";
import { getSupplierUnreadCount } from "@/lib/chat-data";
import { getSupplierIdentity } from "@/lib/supplier-identity";
import { getCurrentSession } from "@/lib/session";
import { getSupplierSuggestions } from "@/lib/suggestion-data-v2";

export default async function SupplierSuggestionPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
    redirect("/login?next=/sugestao-produto");
  }

  const [unreadCount, suggestions, supplierIdentity] = await Promise.all([
    getSupplierUnreadCount(session.userId, session.supplierId),
    getSupplierSuggestions(session.supplierId),
    getSupplierIdentity(session.supplierId)
  ]);

  const suggestionsNeedingRevision = suggestions.filter((item) => item.canResubmit).length;

  return (
    <SupplierPageShell
      unreadCount={unreadCount}
      supplierName={supplierIdentity.supplierName}
      supplierInitials={supplierIdentity.supplierInitials}
      supplierLogoUrl={supplierIdentity.supplierLogoUrl}
      title="Sugestao de Produto"
      description="Envie novos produtos para a equipe de cadastro Pepper com fotos, preco e informacoes estruturadas para facilitar a futura geracao de SKU."
      pepperIaPageKey="suggestion"
      pepperIaHint={
        suggestions.length > 0
          ? `Voce tem ${suggestions.length} sugestoes recentes e ${suggestionsNeedingRevision} aguardando correcao ou nova revisao.`
          : "Anexe fotos de frente e costas e use a Pepper IA para validar a sugestao antes do envio."
      }
    >
      <SupplierSuggestionForm suggestions={suggestions} />
    </SupplierPageShell>
  );
}
