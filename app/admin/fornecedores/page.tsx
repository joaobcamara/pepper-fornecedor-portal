import { redirect } from "next/navigation";
import { AdminSuppliersManagerV2 as AdminSuppliersManager } from "@/components/admin-suppliers-manager-v2";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { getDemoSupplierDirectory } from "@/lib/demo-data";
import { getLocalSupplierDirectory } from "@/lib/local-operations-store";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";

function withEmptyLinkedProducts<T extends { productCount: number }>(suppliers: T[]) {
  return suppliers.map((supplier) => ({
    ...supplier,
    linkedProducts: []
  }));
}

export default async function AdminSuppliersPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/fornecedores");
  }

  const supplierUsage = isLocalOperationalMode()
    ? await getLocalSupplierDirectory().then((suppliers) => withEmptyLinkedProducts(suppliers))
    : await prisma.supplier
        .findMany({
          include: {
            catalogProducts: {
              include: {
                catalogProduct: {
                  include: {
                    images: {
                      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
                    }
                  }
                }
              },
              orderBy: {
                updatedAt: "desc"
              }
            },
            users: true
          },
          orderBy: {
            createdAt: "desc"
          }
        })
        .then((suppliers) =>
          suppliers.map((supplier) => ({
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
            productCount: supplier.catalogProducts.filter((link) => link.active).length,
            userCount: supplier.users.length,
            createdAt: supplier.createdAt.toLocaleDateString("pt-BR"),
            linkedProducts: supplier.catalogProducts.map((link) => ({
              id: link.id,
              catalogProductId: link.catalogProductId,
              parentSku: link.catalogProduct.skuParent,
              name: link.catalogProduct.name,
              imageUrl:
                link.catalogProduct.mainImageUrl ??
                link.catalogProduct.images.find((image) => image.isPrimary)?.url ??
                link.catalogProduct.images[0]?.url ??
                null,
              active: link.active,
              supplierSalePrice: link.supplierSalePrice ?? null,
              criticalStockThreshold: link.criticalStockThreshold ?? null,
              lowStockThreshold: link.lowStockThreshold ?? null
            }))
          }))
        )
        .catch(async () => withEmptyLinkedProducts(getDemoSupplierDirectory()));

  const productOptions = isLocalOperationalMode()
    ? []
    : await prisma.catalogProduct
        .findMany({
          where: {
            active: true,
            archivedAt: null
          },
          select: {
            id: true,
            skuParent: true,
            name: true,
            mainImageUrl: true,
            images: {
              select: {
                url: true,
                isPrimary: true
              },
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
            }
          },
          orderBy: {
            skuParent: "asc"
          }
        })
        .then((products) =>
          products.map((product) => ({
            id: product.id,
            parentSku: product.skuParent,
            name: product.name,
            imageUrl:
              product.mainImageUrl ??
              product.images.find((image) => image.isPrimary)?.url ??
              product.images[0]?.url ??
              null
          }))
        )
        .catch(() => []);
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
      <AdminSuppliersManager suppliers={supplierUsage} productOptions={productOptions} />
    </AdminShell>
  );
}
