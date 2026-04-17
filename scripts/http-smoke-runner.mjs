import { existsSync, readFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const cwd = process.cwd();
const host = "127.0.0.1";
const port = Number(process.env.SMOKE_PORT ?? "3040");
const baseUrl = `http://${host}:${port}`;
const requestTimeoutMs = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? "30000");
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS ?? "25000");
const storePath = path.join(cwd, ".local-data", "operations-store.json");
const probeSalesEnabled = process.argv.includes("--probe-sales") || process.env.SMOKE_PROBE_SALES === "1";

function loadDotEnvIfNeeded() {
  const envPath = path.join(cwd, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
}

loadDotEnvIfNeeded();

if (!process.env.DATABASE_URL?.trim() && process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL.trim();
}

const prisma = new PrismaClient();
let latestServerStdout = "";
let latestServerStderr = "";

function log(message) {
  process.stdout.write(`${message}\n`);
}

function fail(message) {
  throw new Error(message);
}

function getServerLogTail() {
  const stdoutTail = latestServerStdout.trim().split("\n").slice(-20).join("\n");
  const stderrTail = latestServerStderr.trim().split("\n").slice(-20).join("\n");
  return [`SERVER STDOUT:\n${stdoutTail || "(vazio)"}`, `SERVER STDERR:\n${stderrTail || "(vazio)"}`].join("\n");
}

function makeController(timeoutMs = requestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timer };
}

async function request(pathname, options = {}) {
  const { timeoutMs = requestTimeoutMs, ...fetchOptions } = options;
  const { controller, timer } = makeController(timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...fetchOptions,
      signal: controller.signal
    });

    const text = await response.text();

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      text
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Timeout ao chamar ${pathname} em ${timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(label, text) {
  try {
    return JSON.parse(text);
  } catch {
    fail(`${label} retornou JSON invalido: ${text.slice(0, 240)}`);
  }
}

async function login(username, password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  if (response.status !== 200) {
    fail(`Login ${username} falhou com status ${response.status}: ${response.text.slice(0, 240)}`);
  }

  const payload = parseJson(`login ${username}`, response.text);
  const setCookie = response.headers["set-cookie"] ?? "";
  const cookie = setCookie.split(";")[0];

  if (!cookie.startsWith("pepper_session=")) {
    fail(`Login ${username} nao retornou cookie de sessao valido.`);
  }

  log(`[OK] Login ${username} -> ${payload.redirectTo ?? "sem redirect"}`);
  return cookie;
}

function getLocalReplenishmentCount() {
  if (!existsSync(storePath)) {
    return 0;
  }

  const content = readFileSync(storePath, "utf8");
  const parsed = JSON.parse(content);
  return Array.isArray(parsed.replenishmentRequests) ? parsed.replenishmentRequests.length : 0;
}

async function loadSalesCounts() {
  const [orders, items, variantMetrics, productMetrics, supplierMetrics] = await prisma.$transaction([
    prisma.salesOrder.count(),
    prisma.salesOrderItem.count(),
    prisma.variantSalesMetricDaily.count(),
    prisma.productSalesMetricDaily.count(),
    prisma.supplierSalesMetricDaily.count()
  ]);

  return {
    orders,
    items,
    variantMetrics,
    productMetrics,
    supplierMetrics
  };
}

async function resolveActiveSupplier() {
  const supplier = await prisma.supplier.findFirst({
    where: {
      active: true
    },
    orderBy: {
      name: "asc"
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!supplier) {
    fail("Nenhum fornecedor ativo encontrado para o smoke HTTP.");
  }

  return supplier;
}

async function resolveSmokeCatalogProduct(supplierId) {
  const product = await prisma.catalogProduct.findFirst({
    where: {
      skuParent: "01-2504",
      supplierLinks: {
        some: {
          supplierId,
          active: true
        }
      }
    },
    include: {
      variants: {
        include: {
          inventory: true
        },
        orderBy: {
          sku: "asc"
        }
      }
    }
  });

  if (!product || product.variants.length === 0) {
    fail("Produto base 01-2504 nao foi encontrado com variacoes ativas para o smoke.");
  }

  return product;
}

async function runSmoke() {
  latestServerStdout = "";
  latestServerStderr = "";
  const serverEnv = { ...process.env };

  if (serverEnv.DIRECT_URL?.trim()) {
    serverEnv.DATABASE_URL = serverEnv.DIRECT_URL.trim();
  }

  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", host], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: serverEnv
  });

  let startupBuffer = "";
  let startupError = "";
  let ready = false;

  child.stdout.on("data", (chunk) => {
    latestServerStdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    latestServerStderr += chunk.toString();
  });

  const waitForReady = new Promise((resolve, reject) => {
    const startupTimer = setTimeout(() => {
      reject(new Error(`Next start nao ficou pronto em ${startupTimeoutMs}ms.\nSTDOUT:\n${startupBuffer}\nSTDERR:\n${startupError}`));
    }, startupTimeoutMs);

    const onReady = (chunk) => {
      const text = chunk.toString();
      startupBuffer += text;
      if (/Ready in|✓ Ready/i.test(text) && !ready) {
        ready = true;
        clearTimeout(startupTimer);
        resolve(undefined);
      }
    };

    const onError = (chunk) => {
      startupError += chunk.toString();
    };

    child.stdout.on("data", onReady);
    child.stderr.on("data", onError);
    child.once("exit", (code) => {
      if (!ready) {
        clearTimeout(startupTimer);
        reject(new Error(`Next start encerrou antes de ficar pronto (code ${code ?? "null"}).\nSTDOUT:\n${startupBuffer}\nSTDERR:\n${startupError}`));
      }
    });
  });

  const cleanup = () => {
    if (child.exitCode !== null) {
      return;
    }

    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore"
      });
    } catch {
      child.kill("SIGTERM");
    }
  };

  try {
    await waitForReady;
    log(`[OK] next start pronto em ${baseUrl}`);

    const adminCookie = await login("admin", "pepper123");
    const supplierCookie = await login("luna", "pepper123");

    const adminPage = await request("/admin", {
      headers: { Cookie: adminCookie }
    });

    if (adminPage.status !== 200) {
      fail(`Admin autenticado respondeu ${adminPage.status}.`);
    }

    log("[OK] Admin autenticado abriu /admin");

    const syncPage = await request("/admin/sincronizacoes", {
      headers: { Cookie: adminCookie }
    });

    if (syncPage.status !== 200) {
      fail(`Admin autenticado respondeu ${syncPage.status} em /admin/sincronizacoes.`);
    }

    if (!/Fundacao comercial|Sincronizacao manual/i.test(syncPage.text)) {
      fail("Painel de sincronizacoes nao exibiu o bloco esperado da fundacao.");
    }

    log("[OK] Admin autenticado abriu /admin/sincronizacoes com painel da fundacao");

    const stockPage = await request("/admin/estoque", {
      headers: { Cookie: adminCookie }
    });

    if (stockPage.status !== 200) {
      fail(`Admin autenticado respondeu ${stockPage.status} em /admin/estoque.`);
    }

    if (!/Dashboard exclusivo de estoque|Estoque/i.test(stockPage.text)) {
      fail("Painel de estoque nao exibiu o conteudo esperado.");
    }

    log("[OK] Admin autenticado abriu /admin/estoque");

    const whatsappPage = await request("/admin/whatsapp", {
      headers: { Cookie: adminCookie }
    });

    if (whatsappPage.status !== 200) {
      fail(`Admin autenticado respondeu ${whatsappPage.status} em /admin/whatsapp.`);
    }

    if (!/Links portateis compartilhados pelo admin|WhatsApp/i.test(whatsappPage.text)) {
      fail("Central de WhatsApp nao exibiu o conteudo esperado.");
    }

    log("[OK] Admin autenticado abriu /admin/whatsapp");

    const shortWebhookRoutes = [
      "/api/tiny/webhooks/pepper/sales",
      "/api/tiny/webhooks/pepper/orders",
      "/api/tiny/webhooks/showlook/sales",
      "/api/tiny/webhooks/showlook/orders"
    ];

    for (const routePath of shortWebhookRoutes) {
      const shortWebhookPage = await request(routePath);

      if (shortWebhookPage.status !== 200) {
        fail(`Rota curta de webhook respondeu ${shortWebhookPage.status} em ${routePath}.`);
      }
    }

    log("[OK] Rotas curtas de webhook para Pepper e Show Look estao ativas");

    const adminFinancePage = await request("/admin/financeiro", {
      headers: { Cookie: adminCookie }
    });

    if (adminFinancePage.status !== 200) {
      fail(`Admin autenticado respondeu ${adminFinancePage.status} em /admin/financeiro.`);
    }

    log("[OK] Admin autenticado abriu /admin/financeiro");

    const adminMessagesPage = await request("/admin/conversas", {
      headers: { Cookie: adminCookie }
    });

    if (adminMessagesPage.status !== 200) {
      fail(`Admin autenticado respondeu ${adminMessagesPage.status} em /admin/conversas.`);
    }

    log("[OK] Admin autenticado abriu /admin/conversas");

    const legacyImportPage = await request("/admin/importacao-tiny", {
      headers: { Cookie: adminCookie },
      redirect: "manual"
    });

    if (legacyImportPage.status < 300 || legacyImportPage.status >= 400) {
      fail(`Rota legada /admin/importacao-tiny deveria redirecionar, mas respondeu ${legacyImportPage.status}.`);
    }

    if (!legacyImportPage.headers.location?.includes("/admin/produtos")) {
      fail("Rota legada /admin/importacao-tiny nao redirecionou para /admin/produtos.");
    }

    log("[OK] Rota legada /admin/importacao-tiny redireciona para /admin/produtos");

    const supplierPage = await request("/produtos", {
      headers: { Cookie: supplierCookie }
    });

    if (supplierPage.status !== 200) {
      fail(`Fornecedor autenticado respondeu ${supplierPage.status} em /produtos.`);
    }

    log("[OK] Fornecedor autenticado abriu /produtos");

    const supplierDashboardPage = await request("/dashboard", {
      headers: { Cookie: supplierCookie }
    });

    if (supplierDashboardPage.status !== 200) {
      fail(`Fornecedor autenticado respondeu ${supplierDashboardPage.status} em /dashboard.`);
    }

    log("[OK] Fornecedor autenticado abriu /dashboard");

    const supplierFinancePage = await request("/financeiro", {
      headers: { Cookie: supplierCookie }
    });

    if (supplierFinancePage.status !== 200) {
      fail(`Fornecedor autenticado respondeu ${supplierFinancePage.status} em /financeiro.`);
    }

    log("[OK] Fornecedor autenticado abriu /financeiro");

    const supplierMessagesPage = await request("/mensagens", {
      headers: { Cookie: supplierCookie }
    });

    if (supplierMessagesPage.status !== 200) {
      fail(`Fornecedor autenticado respondeu ${supplierMessagesPage.status} em /mensagens.`);
    }

    log("[OK] Fornecedor autenticado abriu /mensagens");

    const supplierSuggestionPage = await request("/sugestao-produto", {
      headers: { Cookie: supplierCookie }
    });

    if (supplierSuggestionPage.status !== 200) {
      fail(`Fornecedor autenticado respondeu ${supplierSuggestionPage.status} em /sugestao-produto.`);
    }

    log("[OK] Fornecedor autenticado abriu /sugestao-produto");

    const supplierOrdersPage = await request("/pedidos-recebidos", {
      headers: { Cookie: supplierCookie }
    });

    if (supplierOrdersPage.status !== 200) {
      fail(`Fornecedor autenticado respondeu ${supplierOrdersPage.status} em /pedidos-recebidos.`);
    }

    log("[OK] Fornecedor autenticado abriu /pedidos-recebidos");

    const activeSupplier = await resolveActiveSupplier();
    log(`[OK] Smoke usando fornecedor ativo ${activeSupplier.name}`);
    const smokeProduct = await resolveSmokeCatalogProduct(activeSupplier.id);
    log(`[OK] Smoke usando produto base ${smokeProduct.skuParent}`);
    const smokeVariants = smokeProduct.variants.slice(0, 2).map((variant) => ({
      catalogVariantId: variant.id,
      sku: variant.sku,
      productName: smokeProduct.name,
      color: variant.colorLabel ?? "",
      size: variant.sizeLabel ?? "",
      currentStock: variant.inventory?.availableMultiCompanyStock ?? null,
      requestedQuantity: 1,
      unitCost: Number(variant.costPrice ?? 0)
    }));

    const htmlExport = await request("/api/admin/purchase-order/html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie
      },
      body: JSON.stringify({
        supplierName: activeSupplier.name,
        productName: smokeProduct.name,
        productSku: smokeProduct.skuParent,
        imageUrl: smokeProduct.mainImageUrl ?? null,
        note: "Smoke check automatico",
        variants: smokeVariants.map((item) => ({
          sku: item.sku,
          size: item.size,
          color: item.color,
          currentStock: item.currentStock,
          requestedQuantity: item.requestedQuantity
        }))
      })
    });

    const htmlExportPayload = parseJson("html pedido admin", htmlExport.text);

    if (
      htmlExport.status !== 200 ||
      typeof htmlExportPayload.html !== "string" ||
      !htmlExportPayload.html.includes("data:image") ||
      !htmlExportPayload.html.includes(smokeProduct.name)
    ) {
      fail(`HTML do pedido nao foi gerado como esperado: ${htmlExport.text.slice(0, 320)}`);
    }

    log("[OK] HTML do pedido admin foi gerado com imagens embarcadas");

    let whatsappShareLinkId = null;

    try {
      const whatsappShare = await request("/api/whatsapp-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie
        },
        body: JSON.stringify({
          supplierId: activeSupplier.id,
          productSku: smokeProduct.skuParent,
          productName: smokeProduct.name,
          imageUrl: smokeProduct.mainImageUrl ?? null,
          note: "Smoke check automatico",
          items: smokeVariants.map((item) => ({
            sku: item.sku,
            size: item.size,
            color: item.color,
            currentStock: item.currentStock,
            requestedQuantity: item.requestedQuantity
          }))
        })
      });

      const whatsappSharePayload = parseJson("whatsapp share", whatsappShare.text);

      if (
        whatsappShare.status !== 200 ||
        typeof whatsappSharePayload.id !== "string" ||
        typeof whatsappSharePayload.shareUrl !== "string" ||
        !whatsappSharePayload.shareUrl.includes("/whatsapp/")
      ) {
        fail(`Link do WhatsApp nao foi criado como esperado: ${whatsappShare.text.slice(0, 320)}`);
      }

      whatsappShareLinkId = whatsappSharePayload.id;
      const shareUrl = new URL(whatsappSharePayload.shareUrl);
      const whatsappSharePage = await request(shareUrl.pathname, {
        headers: {
          Cookie: adminCookie
        }
      });

      if (
        whatsappSharePage.status !== 200 ||
        !whatsappSharePage.text.includes(smokeProduct.name) ||
        !whatsappSharePage.text.includes(smokeProduct.skuParent)
      ) {
        fail("Pagina publica do link WhatsApp nao abriu com o conteudo esperado.");
      }

      log("[OK] Link publico do WhatsApp abriu com leitura viva da fundacao");
    } finally {
      if (whatsappShareLinkId) {
        await prisma.whatsAppShareLink.delete({
          where: {
            id: whatsappShareLinkId
          }
        }).catch(() => undefined);
      }
    }

    const inspect2504 = await request("/api/admin/tiny/inspect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie
      },
      body: JSON.stringify({ sku: "01-2504" })
    });

    const inspect2504Payload = parseJson("inspect 01-2504", inspect2504.text);

    if (inspect2504.status !== 200 || inspect2504Payload.source !== "foundation") {
      fail(`Inspect 01-2504 nao veio da fundacao. Status ${inspect2504.status}. Body: ${inspect2504.text.slice(0, 300)}`);
    }

    log("[OK] SKU 01-2504 respondeu por fundacao primeiro");

    const inspect1195 = await request("/api/admin/tiny/inspect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie
      },
      body: JSON.stringify({ sku: "01-1195" })
    });

    if (inspect1195.status === 200) {
      const inspect1195Payload = parseJson("inspect 01-1195", inspect1195.text);
      log(`[OK] SKU 01-1195 respondeu com source ${inspect1195Payload.source} (${inspect1195Payload.sourceAccountLabel ?? "sem label"})`);
    } else {
      log(`[WARN] SKU 01-1195 nao fechou com sucesso (${inspect1195.status}): ${inspect1195.text.slice(0, 220)}`);
    }

    const import2504 = await request("/api/admin/tiny/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie
      },
      body: JSON.stringify({ sku: "01-2504", supplierIds: [activeSupplier.id] })
    });

    const import2504Payload = parseJson("import 01-2504", import2504.text);

    if (
      import2504.status !== 200 ||
      import2504Payload.source !== "foundation" ||
      import2504Payload.verification?.storedInFoundation !== true
    ) {
      fail(`Import 01-2504 nao confirmou persistencia na fundacao: ${import2504.text.slice(0, 320)}`);
    }

    log("[OK] Import 01-2504 confirmou fundacao + vinculo");

    const smokeVariant =
      smokeProduct.variants.find((variant) => variant.inventory?.availableMultiCompanyStock !== null) ??
      smokeProduct.variants[0];

    const originalInventory = smokeVariant.inventory
      ? {
          availableMultiCompanyStock: smokeVariant.inventory.availableMultiCompanyStock,
          stockStatus: smokeVariant.inventory.stockStatus,
          inventorySyncStatus: smokeVariant.inventory.inventorySyncStatus,
          lastStockSyncAt: smokeVariant.inventory.lastStockSyncAt
        }
      : null;

    const originalSourceProduct = smokeVariant.sourceProductId
      ? await prisma.product.findUnique({
          where: {
            id: smokeVariant.sourceProductId
          },
          select: {
            fallbackInventory: true,
            lastSyncedAt: true,
            syncStatus: true
          }
        })
      : null;

    const stockSmokeStartedAt = new Date();
    const simulatedStock = (originalInventory?.availableMultiCompanyStock ?? 0) + 1;
    const webhookHeaders = {
      "Content-Type": "application/json",
      ...(process.env.TINY_WEBHOOK_SECRET?.trim()
        ? {
            "x-webhook-secret": process.env.TINY_WEBHOOK_SECRET.trim()
          }
        : {})
    };

    try {
      const stockWebhook = await request("/api/tiny/webhooks/stock", {
        method: "POST",
        headers: webhookHeaders,
        body: JSON.stringify({
          tipo: "smoke_stock",
          dados: {
            sku: smokeVariant.sku,
            saldo: simulatedStock
          }
        })
      });

      const stockWebhookPayload = parseJson("stock webhook", stockWebhook.text);

      if (stockWebhook.status !== 200 || stockWebhookPayload.ok !== true || stockWebhookPayload.sku !== smokeVariant.sku) {
        fail(`Webhook de estoque nao refletiu como esperado: ${stockWebhook.text.slice(0, 320)}`);
      }

      const updatedInventory = await prisma.catalogInventory.findUnique({
        where: {
          catalogVariantId: smokeVariant.id
        },
        select: {
          availableMultiCompanyStock: true
        }
      });

      if (!updatedInventory || updatedInventory.availableMultiCompanyStock !== simulatedStock) {
        fail("CatalogInventory nao refletiu o saldo enviado pelo webhook de estoque.");
      }

      const stockWebhookLog = await prisma.tinyWebhookLog.findFirst({
        where: {
          webhookType: "stock",
          eventType: "smoke_stock",
          sku: smokeVariant.sku,
          createdAt: {
            gte: stockSmokeStartedAt
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      if (!stockWebhookLog || stockWebhookLog.status !== "processed") {
        fail("TinyWebhookLog nao registrou o processamento do webhook de estoque.");
      }

      log("[OK] Webhook de estoque atualizou CatalogInventory e gerou log na fundacao");
    } finally {
      await prisma.tinyWebhookLog.deleteMany({
        where: {
          webhookType: "stock",
          eventType: "smoke_stock",
          sku: smokeVariant.sku,
          createdAt: {
            gte: stockSmokeStartedAt
          }
        }
      }).catch(() => undefined);

      await prisma.catalogInventory.upsert({
        where: {
          catalogVariantId: smokeVariant.id
        },
        update: {
          availableMultiCompanyStock: originalInventory?.availableMultiCompanyStock ?? null,
          stockStatus: originalInventory?.stockStatus ?? null,
          inventorySyncStatus: originalInventory?.inventorySyncStatus ?? "STALE",
          lastStockSyncAt: originalInventory?.lastStockSyncAt ?? null,
          source: "tiny"
        },
        create: {
          catalogVariantId: smokeVariant.id,
          availableMultiCompanyStock: originalInventory?.availableMultiCompanyStock ?? null,
          stockStatus: originalInventory?.stockStatus ?? null,
          inventorySyncStatus: originalInventory?.inventorySyncStatus ?? "STALE",
          lastStockSyncAt: originalInventory?.lastStockSyncAt ?? null,
          source: "tiny"
        }
      }).catch(() => undefined);

      if (smokeVariant.sourceProductId) {
        await prisma.inventorySnapshot.deleteMany({
          where: {
            productId: smokeVariant.sourceProductId,
            syncedAt: {
              gte: stockSmokeStartedAt
            }
          }
        }).catch(() => undefined);

        await prisma.product.update({
          where: {
            id: smokeVariant.sourceProductId
          },
          data: {
            fallbackInventory: originalSourceProduct?.fallbackInventory ?? null,
            lastSyncedAt: originalSourceProduct?.lastSyncedAt ?? null,
            syncStatus: originalSourceProduct?.syncStatus ?? "STALE"
          }
        }).catch(() => undefined);
      }
    }

    const createAdminOrder = await request("/api/admin/supplier-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie
      },
      body: JSON.stringify({
        supplierId: activeSupplier.id,
        productId: smokeProduct.id,
        productName: smokeProduct.name,
        productSku: smokeProduct.skuParent,
        imageUrl: smokeProduct.mainImageUrl ?? null,
        adminNote: "Smoke check automatico",
        items: smokeVariants.map((variant) => ({
          catalogVariantId: variant.catalogVariantId,
          sku: variant.sku,
          productName: smokeProduct.name,
          color: variant.color,
          size: variant.size,
          requestedQuantity: variant.requestedQuantity,
          unitCost: variant.unitCost
        }))
      })
    });

    const adminOrderPayload = parseJson("admin supplier order", createAdminOrder.text);

    if (
      createAdminOrder.status !== 200 ||
      adminOrderPayload.ok !== true ||
      adminOrderPayload.verification?.storedInFoundation !== true ||
      adminOrderPayload.verification?.visibleForSupplier !== true
    ) {
      fail(`Pedido do admin nao refletiu como esperado: ${createAdminOrder.text.slice(0, 320)}`);
    }

    log("[OK] Pedido do admin gravou na fundacao e ficou visivel para o fornecedor");

    const createReplenishment = await request("/api/supplier/replenishment-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: supplierCookie
      },
      body: JSON.stringify({
        supplierName: "Luna Textil",
        productName: "Conjunto Fitness Aura",
        productSku: "01-2504",
        imageUrl: "/brand/pepper-logo.png",
        note: "Smoke check automatico",
        variants: [
          {
            sku: "01-2504-21-01",
            size: "P",
            color: "Preto",
            currentStock: 1,
            requestedQuantity: 2
          }
        ]
      })
    });

    const replenishmentPayload = parseJson("supplier replenishment", createReplenishment.text);

    if (
      createReplenishment.status !== 200 ||
      replenishmentPayload.ok !== true ||
      replenishmentPayload.verification?.storedInFoundation !== true ||
      replenishmentPayload.verification?.visibleForAdmin !== true
    ) {
      fail(`Solicitacao de reposicao nao refletiu como esperado: ${createReplenishment.text.slice(0, 320)}`);
    }

    log("[OK] Reposicao do fornecedor gravou na fundacao e ficou visivel para admin");

    if (probeSalesEnabled) {
      const salesBefore = await loadSalesCounts();
      const reconcileSales = await request("/api/admin/sincronizacoes/reconcile-sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie
        },
        timeoutMs: 60000,
        body: JSON.stringify({
          days: 3,
          maxPages: 1,
          maxOrders: 12
        })
      });

      if (reconcileSales.status !== 200) {
        log(`[WARN] Probe de vendas retornou ${reconcileSales.status}: ${reconcileSales.text.slice(0, 280)}`);
      } else {
        const reconcileSalesPayload = parseJson("probe de vendas", reconcileSales.text);
        const salesAfter = await loadSalesCounts();
        log(
          `[INFO] Probe de vendas status=${reconcileSalesPayload.status ?? "unknown"} processed=${reconcileSalesPayload.processed ?? 0} failed=${reconcileSalesPayload.failed ?? 0} pedidos=${salesBefore.orders}->${salesAfter.orders} metricasProduto=${salesBefore.productMetrics}->${salesAfter.productMetrics}`
        );
      }
    }

    log("=== Smoke HTTP concluido com sucesso ===");
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    cleanup();
  }
}

runSmoke().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[FAIL] ${message}\n${getServerLogTail()}\n`);
  process.exitCode = 1;
});
