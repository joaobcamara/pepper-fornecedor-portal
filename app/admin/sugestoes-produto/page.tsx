import { redirect } from "next/navigation";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { AdminSuggestionWorkbenchV3 as AdminSuggestionWorkbench } from "@/components/admin-suggestion-workbench-v3";
import { getCurrentSession } from "@/lib/session";
import { getAdminSuggestionCards } from "@/lib/suggestion-data-v2";

export default async function AdminSuggestionsPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/sugestoes-produto");
  }

  const suggestions = await getAdminSuggestionCards();
  const underReviewCount = suggestions.filter((item) => item.status === "NEW" || item.status === "REVIEWING").length;
  const needsRevisionCount = suggestions.filter((item) => item.status === "NEEDS_REVISION").length;
  const approvedCount = suggestions.filter((item) => item.status === "APPROVED_FOR_CATALOG").length;
  const pepperIaAlertCount = underReviewCount + needsRevisionCount;

  return (
    <AdminShell
      currentPath="/admin/sugestoes-produto"
      title="Sugestoes de Produto"
      description="Receba produtos sugeridos pelos fornecedores, analise os dados e aprove somente o que deve seguir para a fila de cadastro no Supabase."
      pepperIaPageKey="suggestion"
      pepperIaAlertCount={pepperIaAlertCount}
      pepperIaHint={
        suggestions.length > 0
          ? `${underReviewCount} cards seguem em analise, ${needsRevisionCount} pedem correcao, ${approvedCount} ja foram aprovados e ${suggestions.filter((item) => item.onboardingItem).length} ja passaram pela fila de cadastro.`
          : "Aqui a Pepper IA pode ajudar a priorizar o que precisa de correcao e o que ja esta pronto para cadastro."
      }
    >
      <AdminSuggestionWorkbench suggestions={suggestions} />
    </AdminShell>
  );
}


