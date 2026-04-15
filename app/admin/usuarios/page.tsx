import { redirect } from "next/navigation";
import { AdminUsersManager } from "@/components/admin-users-manager";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export default async function AdminUsersPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/usuarios");
  }

  const [users, suppliers] = await Promise.all([
    prisma.user
      .findMany({
        include: {
          supplier: true
        },
        orderBy: {
          createdAt: "desc"
        }
      })
      .catch(() => []),
    prisma.supplier
      .findMany({
        where: {
          active: true
        },
        orderBy: {
          name: "asc"
        }
      })
      .catch(() => [])
  ]);
  const inactiveUsersCount = users.filter((user) => !user.active).length;
  const supplierUsersWithoutScopeCount = users.filter((user) => user.role === "SUPPLIER" && !user.supplierId).length;
  const adminUsersCount = users.filter((user) => user.role === "ADMIN").length;
  const pepperIaAlertCount = inactiveUsersCount + supplierUsersWithoutScopeCount;

  return (
    <AdminShell
      currentPath="/admin/usuarios"
      title="Usuarios"
      description="Crie, ative e ajuste os acessos do admin e dos fornecedores, incluindo troca de senha e vinculo de escopo."
      pepperIaPageKey="users"
      pepperIaAlertCount={pepperIaAlertCount}
      pepperIaHint={
        users.length > 0
          ? `${users.length} usuarios estao cadastrados, ${adminUsersCount} sao admin, ${inactiveUsersCount} estao inativos e ${supplierUsersWithoutScopeCount} perfis de fornecedor ainda pedem vinculo de escopo.`
          : "Cadastre acessos do time Pepper e dos fornecedores com os vinculos corretos antes de subir o sistema."
      }
    >
      <AdminUsersManager
        users={users.map((user) => ({
          id: user.id,
          username: user.username,
          role: user.role,
          active: user.active,
          supplierId: user.supplierId,
          supplierName: user.supplier?.name ?? null,
          lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toLocaleString("pt-BR") : null,
          createdAt: user.createdAt.toLocaleDateString("pt-BR")
        }))}
        suppliers={suppliers.map((supplier) => ({
          id: supplier.id,
          name: supplier.name
        }))}
      />
    </AdminShell>
  );
}
