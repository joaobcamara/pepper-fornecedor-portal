import { prisma } from "@/lib/prisma";
import { reconcileTinySalesOrders } from "@/lib/tiny-sales-events";

function log(message: string) {
  process.stdout.write(`${message}\n`);
}

async function main() {
  const beforeCounts = await prisma.$transaction([
    prisma.salesOrder.count(),
    prisma.salesOrderItem.count(),
    prisma.variantSalesMetricDaily.count(),
    prisma.productSalesMetricDaily.count(),
    prisma.supplierSalesMetricDaily.count()
  ]);

  log("=== Probe de reconciliacao de vendas Tiny -> Fundacao ===");
  log(
    `[INFO] Antes: pedidos=${beforeCounts[0]}, itens=${beforeCounts[1]}, metricasVariante=${beforeCounts[2]}, metricasProduto=${beforeCounts[3]}, metricasFornecedor=${beforeCounts[4]}`
  );

  const result = await reconcileTinySalesOrders({
    days: 3,
    maxPages: 1,
    maxOrders: 12,
    requestedByUserId: null
  });

  log(`[INFO] Resultado: ${JSON.stringify(result)}`);

  const afterCounts = await prisma.$transaction([
    prisma.salesOrder.count(),
    prisma.salesOrderItem.count(),
    prisma.variantSalesMetricDaily.count(),
    prisma.productSalesMetricDaily.count(),
    prisma.supplierSalesMetricDaily.count()
  ]);

  log(
    `[INFO] Depois: pedidos=${afterCounts[0]}, itens=${afterCounts[1]}, metricasVariante=${afterCounts[2]}, metricasProduto=${afterCounts[3]}, metricasFornecedor=${afterCounts[4]}`
  );

  log("=== Probe concluido ===");
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[FAIL] Probe de vendas interrompido: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
