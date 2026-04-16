import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createLocalAdminSupplierOrder,
  createLocalFinancialEntry,
  getLocalAdminFinancialBoardData,
  getLocalAdminSupplierOrderPageData,
  getLocalSupplierFinancialBoardData,
  getLocalSupplierReceivedOrders,
  updateLocalFinancialEntry,
  updateLocalSupplierOrder
} from "@/lib/local-operations-store";

const storePath = path.join(process.cwd(), ".local-data", "operations-store.json");

function log(message: string) {
  process.stdout.write(`${message}\n`);
}

async function main() {
  const originalStore = existsSync(storePath) ? readFileSync(storePath, "utf8") : null;

  try {
    log("=== Smoke check da fundacao Grupo Pepper ===");

    const initialPageData = await getLocalAdminSupplierOrderPageData();
    const supplier = initialPageData.suppliers[0];
    const product = initialPageData.products.find((item) => item.supplierId === supplier?.id) ?? initialPageData.products[0];

    if (!supplier || !product) {
      throw new Error("Nao ha fornecedor/produto suficiente para executar o smoke check.");
    }

    const variant = product.variants[0];

    if (!variant) {
      throw new Error("Produto sem variacoes para o smoke check.");
    }

    const createdOrder = await createLocalAdminSupplierOrder({
      supplierId: supplier.id,
      productId: product.id,
      productName: product.productName,
      productSku: product.productSku,
      imageUrl: product.imageUrl,
      adminNote: "Smoke check automatico da fundacao.",
      actorUsername: "smoke-check",
      items: [
        {
          catalogVariantId: variant.id,
          sku: variant.sku,
          productName: `${product.productName} ${variant.color} ${variant.size}`,
          color: variant.color,
          size: variant.size,
          requestedQuantity: 2,
          unitCost: variant.unitCost ?? 0
        }
      ]
    });

    const supplierOrdersAfterCreate = await getLocalSupplierReceivedOrders(supplier.id);
    const visibleForSupplier = supplierOrdersAfterCreate.some((order) => order.id === createdOrder.id);
    log(visibleForSupplier ? "[OK] Pedido criado e visivel para o fornecedor." : "[FAIL] Pedido nao apareceu para o fornecedor.");

    await updateLocalSupplierOrder({
      supplierId: supplier.id,
      orderId: createdOrder.id,
      supplierNote: "Separacao confirmada no smoke check.",
      requestedStatus: "IN_PREPARATION",
      workflowAction: "PREPARE_ORDER",
      supplierHasNoStock: false,
      actorUsername: "smoke-check",
      items: [
        {
          id: createdOrder.items[0].id,
          fulfilledQuantity: 2,
          itemStatus: "AVAILABLE",
          supplierItemNote: "Tudo disponivel",
          confirmedUnitCost: createdOrder.items[0].unitCost
        }
      ]
    });

    await updateLocalSupplierOrder({
      supplierId: supplier.id,
      orderId: createdOrder.id,
      supplierNote: "Pronto para o financeiro.",
      requestedStatus: "SUPPLIER_REVIEWED",
      workflowAction: "CONFIRM_SEPARATION",
      supplierHasNoStock: false,
      actorUsername: "smoke-check",
      items: [
        {
          id: createdOrder.items[0].id,
          fulfilledQuantity: 2,
          itemStatus: "AVAILABLE",
          supplierItemNote: "Separado",
          confirmedUnitCost: createdOrder.items[0].unitCost
        }
      ]
    });

    const financialEntry = await createLocalFinancialEntry({
      supplierId: supplier.id,
      orderId: createdOrder.id,
      amount: createdOrder.items[0].requestedTotalCost,
      note: "Enviado ao financeiro pelo smoke check.",
      supplierNote: "Pedido pronto para pagamento."
    });

    const adminFinancialBoard = await getLocalAdminFinancialBoardData();
    const supplierFinancialBoard = await getLocalSupplierFinancialBoardData(supplier.id);
    const visibleForAdminFinancial = adminFinancialBoard.some((entry) => entry.id === financialEntry.id);
    const visibleForSupplierFinancial = supplierFinancialBoard.entries.some((entry) => entry.id === financialEntry.id);

    log(
      visibleForAdminFinancial && visibleForSupplierFinancial
        ? "[OK] Card financeiro armazenado na fundacao e visivel para admin e fornecedor."
        : "[FAIL] Card financeiro nao refletiu corretamente entre admin e fornecedor."
    );

    await updateLocalFinancialEntry({
      financialEntryId: financialEntry.id,
      status: "PENDING_PAYMENT",
      note: "Pagamento aguardando baixa Pepper."
    });

    await updateLocalFinancialEntry({
      financialEntryId: financialEntry.id,
      status: "PAID",
      note: "Pagamento concluido no smoke check."
    });

    const supplierOrdersAfterPayment = await getLocalSupplierReceivedOrders(supplier.id);
    const paidOrder = supplierOrdersAfterPayment.find((order) => order.id === createdOrder.id);
    const paidWorkflowOk = paidOrder?.workflowStage === "PAID";

    log(paidWorkflowOk ? "[OK] Pagamento refletiu no pedido do fornecedor." : "[FAIL] Pagamento nao refletiu no pedido.");
    log("=== Smoke check concluido ===");
  } finally {
    if (originalStore !== null) {
      writeFileSync(storePath, originalStore, "utf8");
      log("[OK] Store local restaurado apos o smoke check.");
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[FAIL] Smoke check interrompido: ${message}\n`);
  process.exitCode = 1;
});
