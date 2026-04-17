import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
import {
  PEPPER_TINY_ACCOUNT_REFERENCES,
  type PepperTinyAccountReferenceItem
} from "@/lib/pepper-tiny-account-data";

export type PepperFoundationMultiAccountSnapshot = {
  accounts: PepperTinyAccountReferenceItem[];
  matrixAccountKey: "pepper";
  catalogImportAccountKey: "pepper";
  physicalStockAccountKey: "pepper";
};

export async function getPepperFoundationMultiAccountSnapshot(): Promise<PepperFoundationMultiAccountSnapshot> {
  if (isLocalOperationalMode()) {
    return {
      accounts: PEPPER_TINY_ACCOUNT_REFERENCES,
      matrixAccountKey: "pepper",
      catalogImportAccountKey: "pepper",
      physicalStockAccountKey: "pepper"
    };
  }

  const accounts = await prisma.pepperTinyAccountReference
    .findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }]
    })
    .catch(() => []);

  return {
    accounts:
      accounts.length > 0
        ? accounts.map((item) => {
            const fallback =
              PEPPER_TINY_ACCOUNT_REFERENCES.find((reference) => reference.key === item.key) ??
              PEPPER_TINY_ACCOUNT_REFERENCES[0];

            return {
              ...fallback,
              key: item.key as PepperTinyAccountReferenceItem["key"],
              label: item.label,
              role: item.role,
              sortOrder: item.sortOrder,
              active: item.active,
              sharesGroupStock: item.sharesGroupStock,
              readsAvailableMultiCompany: item.readsAvailableMultiCompany,
              handlesCatalogImport: item.handlesCatalogImport,
              handlesPhysicalStock: item.handlesPhysicalStock,
              zeroBalanceOnCount: item.zeroBalanceOnCount,
              salesAffectSharedStock: item.salesAffectSharedStock
            };
          })
        : PEPPER_TINY_ACCOUNT_REFERENCES,
    matrixAccountKey: "pepper",
    catalogImportAccountKey: "pepper",
    physicalStockAccountKey: "pepper"
  };
}
