import { getLocalSupplierIdentity } from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";

function buildInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "PF";
}

function getDemoSupplierIdentity() {
  return {
    supplierName: "Luna Textil",
    supplierInitials: "LT",
    supplierLogoUrl: null as string | null,
    canViewProductValues: true,
    canViewFinancialDashboard: true
  };
}

export async function getSupplierIdentity(supplierId?: string | null) {
  const allowDemoIdentity = process.env.ALLOW_DEMO_AUTH === "true";

  if (isLocalOperationalMode()) {
    return getLocalSupplierIdentity(supplierId);
  }

  if (!supplierId) {
    return allowDemoIdentity
      ? getDemoSupplierIdentity()
      : {
          supplierName: "Fornecedor Pepper",
          supplierInitials: "PF",
          supplierLogoUrl: null as string | null,
          canViewProductValues: false,
          canViewFinancialDashboard: false
        };
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: {
        name: true,
        logoUrl: true,
        canViewProductValues: true,
        canViewFinancialDashboard: true
      }
    });

    if (!supplier) {
      return allowDemoIdentity
        ? getDemoSupplierIdentity()
        : {
            supplierName: "Fornecedor Pepper",
            supplierInitials: "PF",
            supplierLogoUrl: null as string | null,
            canViewProductValues: false,
            canViewFinancialDashboard: false
          };
    }

    return {
      supplierName: supplier.name,
      supplierInitials: buildInitials(supplier.name),
      supplierLogoUrl: supplier.logoUrl ?? null,
      canViewProductValues: supplier.canViewProductValues,
      canViewFinancialDashboard: supplier.canViewFinancialDashboard
    };
  } catch {
    return allowDemoIdentity
      ? getDemoSupplierIdentity()
      : {
          supplierName: "Fornecedor Pepper",
          supplierInitials: "PF",
          supplierLogoUrl: null as string | null,
          canViewProductValues: false,
          canViewFinancialDashboard: false
        };
  }
}
