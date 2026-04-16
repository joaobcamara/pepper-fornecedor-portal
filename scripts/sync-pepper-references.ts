import { PrismaClient } from "@prisma/client";

import {
  PEPPER_COLOR_REFERENCES,
  PEPPER_SIZE_REFERENCES
} from "../lib/pepper-reference-data";
import { PEPPER_TINY_ACCOUNT_REFERENCES } from "../lib/pepper-tiny-account-data";

const prisma = new PrismaClient();

async function main() {
  for (const item of PEPPER_SIZE_REFERENCES) {
    await prisma.pepperSizeReference.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        sortOrder: item.sortOrder,
        active: true
      },
      create: {
        code: item.code,
        label: item.label,
        sortOrder: item.sortOrder,
        active: true
      }
    });
  }

  for (const item of PEPPER_COLOR_REFERENCES) {
    await prisma.pepperColorReference.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        sortOrder: item.sortOrder,
        active: true
      },
      create: {
        code: item.code,
        label: item.label,
        sortOrder: item.sortOrder,
        active: true
      }
    });
  }

  for (const item of PEPPER_TINY_ACCOUNT_REFERENCES) {
    await prisma.pepperTinyAccountReference.upsert({
      where: { key: item.key },
      update: {
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
      },
      create: {
        key: item.key,
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
      }
    });
  }

  console.log(
    `[OK] Referencias Pepper sincronizadas: ${PEPPER_SIZE_REFERENCES.length} tamanhos, ${PEPPER_COLOR_REFERENCES.length} cores e ${PEPPER_TINY_ACCOUNT_REFERENCES.length} contas Tiny.`
  );
}

main()
  .catch((error) => {
    console.error("[FAIL] sync-pepper-references", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
