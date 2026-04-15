import { promises as fs } from "node:fs";
import path from "node:path";

type OrderVariant = {
  sku: string;
  size: string;
  color: string;
  currentStock: number | null;
  requestedQuantity: number;
};

type PurchaseOrderPayload = {
  supplierName: string;
  productName: string;
  productSku: string;
  imageUrl?: string | null;
  note?: string;
  variants: OrderVariant[];
};

async function toDataUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return null;
  }

  try {
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "image/png";
      const buffer = Buffer.from(await response.arrayBuffer());
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    }

    const localPath = path.join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
    const file = await fs.readFile(localPath);
    const extension = path.extname(localPath).toLowerCase();
    const contentType =
      extension === ".png" ? "image/png" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";

    return `data:${contentType};base64,${file.toString("base64")}`;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function buildPurchaseOrderHtml(payload: PurchaseOrderPayload) {
  const embeddedImage = await toDataUrl(payload.imageUrl);
  const requestedRows = payload.variants
    .filter((variant) => variant.requestedQuantity > 0)
    .map(
      (variant) => `
        <tr>
          <td>${escapeHtml(variant.color)}</td>
          <td>${escapeHtml(variant.size)}</td>
          <td>${escapeHtml(variant.sku)}</td>
          <td>${variant.currentStock ?? "-"}</td>
          <td>${variant.requestedQuantity}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Solicitacao de Reposicao - ${escapeHtml(payload.productSku)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2937; margin: 32px; }
          .header { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 32px; }
          .card { border: 1px solid #f0d4c2; border-radius: 24px; padding: 24px; background: #fffaf7; }
          .badge { display: inline-block; background: #fff1e7; color: #b85629; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
          img { width: 96px; height: 96px; object-fit: contain; border-radius: 20px; background: #fff; border: 1px solid #f2e6dd; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border-bottom: 1px solid #f2e8e0; padding: 12px 10px; text-align: left; }
          th { background: #fff3eb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
          .note { margin-top: 24px; padding: 18px; border-radius: 20px; background: #fff; border: 1px solid #f2e8e0; }
        </style>
      </head>
      <body>
        <div class="header card">
          <div>
            <span class="badge">Solicitacao de Reposicao</span>
            <h1>${escapeHtml(payload.productName)}</h1>
            <p><strong>Fornecedor:</strong> ${escapeHtml(payload.supplierName)}</p>
            <p><strong>SKU pai:</strong> ${escapeHtml(payload.productSku)}</p>
            <p><strong>Gerado em:</strong> ${new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short"
            }).format(new Date())}</p>
          </div>
          ${embeddedImage ? `<img src="${embeddedImage}" alt="${escapeHtml(payload.productName)}" />` : ""}
        </div>

        <div class="card">
          <h2>Itens sugeridos para aprovacao</h2>
          <table>
            <thead>
              <tr>
                <th>Cor</th>
                <th>Tamanho</th>
                <th>SKU</th>
                <th>Estoque atual</th>
                <th>Quantidade sugerida</th>
              </tr>
            </thead>
            <tbody>
              ${requestedRows || '<tr><td colspan="5">Nenhum item selecionado.</td></tr>'}
            </tbody>
          </table>

          ${
            payload.note
              ? `<div class="note"><strong>Observação:</strong><p>${escapeHtml(payload.note)}</p></div>`
              : ""
          }
        </div>
      </body>
    </html>
  `.trim();
}

