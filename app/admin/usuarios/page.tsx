import { redirect } from "next/navigation";
import { AdminUsersManager } from "@/components/admin-users-manager";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { getLocalSupplierDirectory, getLocalUsers } from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
import { getCurrentSession } from "@/lib/session";

export default async function AdminUsersPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/usuarios");
  }

  const [users, suppliers] = isLocalOperationalMode()
    ? await Promise.all([getLocalUsers(), getLocalSupplierDirectory()])
    : await Promise.all([
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
  const mappedUsers = users.map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    active: user.active,
    supplierId: user.supplierId,
    supplierName: "supplier" in user ? user.supplier?.name ?? null : ("supplierName" in user ? user.supplierName : null),
    lastLoginAt:
      "lastLoginAt" in user && typeof user.lastLoginAt === "string"
        ? user.lastLoginAt
        : user.lastLoginAt
          ? user.lastLoginAt.toLocaleString("pt-BR")
          : null,
    createdAt:
      "createdAt" in user && typeof user.createdAt === "string"
        ? user.createdAt
        : new Date(user.createdAt).toLocaleDateString("pt-BR")
  }));
  const mappedSuppliers = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name
  }));
  const inactiveUsersCount = mappedUsers.filter((user) => !user.active).length;
  const supplierUsersWithoutScopeCount = mappedUsers.filter((user) => user.role === "SUPPLIER" && !user.supplierId).length;
  const adminUsersCount = mappedUsers.filter((user) => user.role === "ADMIN").length;
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
      <AdminUsersManager users={mappedUsers} suppliers={mappedSuppliers} />
    </AdminShell>
  );
}
