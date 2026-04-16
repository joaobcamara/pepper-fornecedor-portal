import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const envPath = path.join(root, ".env");
const envExamplePath = path.join(root, ".env.example");
const envSource = existsSync(envPath) ? envPath : existsSync(envExamplePath) ? envExamplePath : null;

const requiredRuntimeKeys = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
  "TINY_API_TOKEN",
  "TINY_SHOWLOOK_API_TOKEN",
  "TINY_ONSHOP_API_TOKEN",
  "TINY_WEBHOOK_SECRET",
  "CRON_SECRET",
  "CATALOG_QUEUE_TOKEN"
];

function parseEnvFile(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");
        return [key, value];
      })
  );
}

function maskValue(value) {
  if (!value) return "(vazio)";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function isPlaceholderValue(value) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return [
    "<project-ref>",
    "<password>",
    "<region>",
    "value",
    "troque-por-uma-chave-longa",
    "troque-por-um-token-seguro"
  ].some((token) => normalized.includes(token));
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function printItem(status, label, detail) {
  const prefix = status === "ok" ? "[OK]" : status === "warn" ? "[WARN]" : "[FAIL]";
  console.log(`${prefix} ${label}${detail ? `: ${detail}` : ""}`);
}

let hasFailure = false;

printSection("Diagnostico de restauracao e deploy");
console.log(`Workspace: ${root}`);

printSection("Arquivos estruturais");
[
  "components/admin-product-inventory-manager.tsx",
  "components/admin-supplier-orders-manager-v2.tsx",
  "components/supplier-financial-operations-board.tsx",
  "app/api/admin/supplier-orders/route.ts",
  "app/api/supplier/financial-entries/route.ts"
].forEach((relativePath) => {
  const fullPath = path.join(root, relativePath);
  if (existsSync(fullPath)) {
    printItem("ok", relativePath, "presente");
  } else {
    hasFailure = true;
    printItem("fail", relativePath, "ausente");
  }
});

printSection("Workspace git");
const gitStatus = spawnSync("git", ["status", "--short"], {
  cwd: root,
  encoding: "utf8"
});
if (gitStatus.status === 0) {
  const lines = gitStatus.stdout.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    printItem("ok", "Git status", "sem alteracoes pendentes");
  } else {
    printItem("warn", "Git status", `${lines.length} alteracoes pendentes`);
    lines.slice(0, 10).forEach((line) => console.log(`  - ${line}`));
  }
} else {
  printItem("warn", "Git status", "nao foi possivel consultar");
}

printSection("Arquivos temporarios");
const tempFiles = readdirSync(root).filter((name) => name.endsWith(".tmp"));
if (tempFiles.length === 0) {
  printItem("ok", "Arquivos .tmp", "nenhum arquivo temporario solto na raiz");
} else {
  printItem("warn", "Arquivos .tmp", `${tempFiles.length} encontrado(s)`);
  tempFiles.forEach((name) => console.log(`  - ${name}`));
}

printSection("Variaveis de ambiente");
if (!envSource) {
  hasFailure = true;
  printItem("fail", "Arquivo .env/.env.example", "nenhuma base de variaveis encontrada");
} else {
  printItem("ok", "Fonte usada", path.basename(envSource));
  const envMap = parseEnvFile(readFileSync(envSource, "utf8"));

  requiredRuntimeKeys.forEach((key) => {
    const value = envMap[key];
    if (!value) {
      hasFailure = true;
      printItem("fail", key, "ausente");
      return;
    }

    if (isPlaceholderValue(value)) {
      hasFailure = true;
      printItem("fail", key, `placeholder detectado (${maskValue(value)})`);
      return;
    }

    printItem("ok", key, maskValue(value));
  });

  const optionalKeys = [
    "OPENAI_API_KEY",
    "OPENAI_SUGGESTION_MODEL",
    "SUPABASE_STORAGE_BUCKET",
    "PRINTNODE_API_KEY",
    "SENDPULSE_CLIENT_ID",
    "SENDPULSE_API_KEY",
    "MERCADO_LIVRE_CLIENT_ID",
    "MERCADO_LIVRE_CLIENT_SECRET",
    "MERCADO_LIVRE_REDIRECT_URI",
    "SHOPEE_PARTNER_ID",
    "SHOPEE_PARTNER_KEY",
    "SHOPEE_SHOP_ID",
    "TIKTOK_SHOP_APP_KEY",
    "TIKTOK_SHOP_APP_SECRET",
    "TIKTOK_SHOP_ID",
    "MAGALU_SELLER_CLIENT_ID",
    "MAGALU_SELLER_CLIENT_SECRET",
    "MAGALU_SELLER_STORE_ID",
    "MELHOR_ENVIO_CLIENT_ID",
    "MELHOR_ENVIO_CLIENT_SECRET",
    "MELHOR_ENVIO_REDIRECT_URI",
    "MELHOR_ENVIO_ACCESS_TOKEN",
    "MELHOR_ENVIO_REFRESH_TOKEN",
    "MERCADO_PAGO_ACCESS_TOKEN",
    "MERCADO_PAGO_PUBLIC_KEY",
    "MERCADO_PAGO_WEBHOOK_SECRET"
  ];
  optionalKeys.forEach((key) => {
    const value = envMap[key];
    if (!value) {
      printItem("warn", key, "nao preenchida");
      return;
    }

    if (isPlaceholderValue(value)) {
      printItem("warn", key, `placeholder detectado (${maskValue(value)})`);
      return;
    }

    printItem("ok", key, maskValue(value));
  });
}

printSection("Conclusao");
if (hasFailure) {
  console.log("Resultado: falhas criticas encontradas. Corrija o ambiente antes do deploy.");
  process.exitCode = 1;
} else {
  console.log("Resultado: diagnostico estrutural aprovado para seguir para build guardado e QA.");
}
