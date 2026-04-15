import { redirect } from "next/navigation";
import { AdminSuppliersManagerV2 as AdminSuppliersManager } from "@/components/admin-suppliers-manager-v2";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function AdminSuppliersPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/fornecedores");
  }

  const suppliers = await prisma.supplier
    .findMany({
      include: {
        assignments: {
          where: {
            active: true
          }
        },
        users: true
      },
      orderBy: {
        createdAt: "desc"
      }
    })
    .catch(() => []);

  const supplierUsage = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    slug: supplier.slug,
    logoUrl: supplier.logoUrl ?? null,
    contactName: supplier.contactName ?? null,
    contactPhone: supplier.contactPhone ?? null,
    contactEmail: supplier.contactEmail ?? null,
    address: supplier.address ?? null,
    active: supplier.active,
    canViewProductValues: supplier.canViewProductValues,
    canViewFinancialDashboard: supplier.canViewFinancialDashboard,
    productCount: new Set(supplier.assignments.map((assignment) => assignment.productId)).size,
    userCount: supplier.users.length,
    createdAt: supplier.createdAt.toLocaleDateString("pt-BR")
  }));
  const inactiveCount = supplierUsage.filter((supplier) => !supplier.active).length;
  const withoutProductsCount = supplierUsage.filter((supplier) => supplier.productCount === 0).length;
  const hiddenFinancialCount = supplierUsage.filter((supplier) => !supplier.canViewFinancialDashboard).length;
  const missingContactCount = supplierUsage.filter((supplier) => !supplier.contactName && !supplier.contactPhone && !supplier.contactEmail).length;
  const pepperIaAlertCount = inactiveCount + withoutProductsCount;

  return (
    <AdminShell
      currentPath="/admin/fornecedores"
      title="Fornecedores"
      description="Cadastre, revise e ative fornecedores com clareza sobre produtos vinculados e usuarios associados."
      pepperIaPageKey="suppliers"
      pepperIaAlertCount={pepperIaAlertCount}
        pepperIaHint={
          supplierUsage.length > 0
          ? `${supplierUsage.length} fornecedores estao cadastrados, ${inactiveCount} estao inativos, ${withoutProductsCount} ainda sem produtos vinculados, ${hiddenFinancialCount} com dashboard financeiro oculto e ${missingContactCount} ainda sem contato registrado.`
          : "Cadastre fornecedores, defina visibilidade financeira e mantenha os vinculos de produto organizados."
      }
    >
      <AdminSuppliersManager suppliers={supplierUsage} />
    </AdminShell>
  );
}
