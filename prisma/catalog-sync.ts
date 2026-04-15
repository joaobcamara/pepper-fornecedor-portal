import { PrismaClient } from "@prisma/client";

import { rebuildCatalogLayer } from "../lib/catalog-sync";

export { rebuildCatalogLayer } from "../lib/catalog-sync";

async function main() {
  const prisma = new PrismaClient();
  await rebuildCatalogLayer(prisma);
  await prisma.$disconnect();
}

if (process.argv[1]?.includes("catalog-sync.ts")) {
  main()
    .catch(async (error) => {
      console.error(error);
      process.exit(1);
    });
}
