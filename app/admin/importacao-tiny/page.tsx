import { redirect } from "next/navigation";
import { AdminImportConsole } from "@/components/admin-import-console";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { getAdminPageData } from "@/lib/admin-data";
import { getCurrentSession } from "@/lib/session";

export default async function AdminImportacaoPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/importacao-tiny");
  }

  const { suppliers, tinyConfigured } = await getAdminPageData();
  const pepperIaAlertCount = tinyConfigured ? 0 : 1;

  return (
    <AdminShell
      currentPath="/admin/importacao-tiny"
      title="Importação Tiny"
      description="Busca por SKU, inspeção de pai e filhas, revisão da grade cor x tamanho e importação segura para o cadastro interno."
      pepperIaPageKey="imports"
      pepperIaAlertCount={pepperIaAlertCount}
      pepperIaHint={
        tinyConfigured
          ? `${suppliers.length} fornecedores ativos estão prontos para receber importação por SKU, com revisão de grade e vínculo antes de salvar.`
          : "A configuração do Tiny ainda precisa ser confirmada antes de iniciar novas importações."
      }
    >
      <AdminImportConsole suppliers={suppliers} tinyConfigured={tinyConfigured} />
    </AdminShell>
  );
}
