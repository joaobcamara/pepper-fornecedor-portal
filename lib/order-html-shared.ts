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

type ExportTemplate = "UNIQUE_COLOR_CARDS" | "SIZE_COLOR_GRID";

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

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function resolveTemplate(variants: OrderVariant[]): ExportTemplate {
  return uniqueValues(variants.map((variant) => variant.size)).length <= 1
    ? "UNIQUE_COLOR_CARDS"
    : "SIZE_COLOR_GRID";
}

function sortVariants(variants: OrderVariant[]) {
  return [...variants].sort((left, right) => {
    if (left.color !== right.color) {
      return left.color.localeCompare(right.color, "pt-BR");
    }

    if (left.size !== right.size) {
      return left.size.localeCompare(right.size, "pt-BR");
    }

    return left.sku.localeCompare(right.sku, "pt-BR");
  });
}

function renderGridSection(variants: OrderVariant[]) {
  const ordered = sortVariants(variants);
  const sizeLabels = uniqueValues(ordered.map((variant) => variant.size));
  const colorLabels = uniqueValues(ordered.map((variant) => variant.color));

  const rows = colorLabels
    .map((color) => {
      const cells = sizeLabels
        .map((size) => {
          const variant = ordered.find((entry) => entry.color === color && entry.size === size) ?? null;

          if (!variant) {
            return `
              <td>
                <div class="matrix-empty">-</div>
              </td>
            `;
          }

          const hasRequest = variant.requestedQuantity > 0;

          return `
            <td>
              <div class="matrix-cell ${hasRequest ? "matrix-cell-active" : ""}">
                <span class="matrix-label">Pedido</span>
                <strong class="matrix-qty">${variant.requestedQuantity}</strong>
                <p class="matrix-stock">Estoque ${variant.currentStock ?? "-"}</p>
                <p class="matrix-sku">${escapeHtml(variant.sku)}</p>
              </div>
            </td>
          `;
        })
        .join("");

      return `
        <tr>
          <th scope="row">
            <div class="matrix-color">
              <span class="matrix-color-name">${escapeHtml(color)}</span>
            </div>
          </th>
          ${cells}
        </tr>
      `;
    })
    .join("");

  return `
    <section class="card">
      <div class="section-head">
        <div>
          <p class="section-eyebrow">Pedido por grade</p>
          <h2 class="section-title">Cor x tamanho</h2>
          <p class="section-copy">
            Leitura pensada para pedido completo. Cada celula mostra quantidade sugerida, estoque atual e SKU da variacao.
          </p>
        </div>
        <span class="section-tag">Grade completa</span>
      </div>

      <div class="matrix-shell">
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="matrix-header matrix-header-sticky">Cor</th>
              ${sizeLabels
                .map(
                  (size) => `
                    <th class="matrix-header">
                      <div class="matrix-size">${escapeHtml(size)}</div>
                    </th>
                  `
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>
  `.trim();
}

function renderUniqueCardsSection(variants: OrderVariant[]) {
  const ordered = sortVariants(variants);

  return `
    <section class="card">
      <div class="section-head">
        <div>
          <p class="section-eyebrow">Pedido por cor</p>
          <h2 class="section-title">Mini cards de tamanho unico</h2>
          <p class="section-copy">
            Cada cor ganha seu proprio card, com leitura direta de estoque, quantidade sugerida e SKU da variacao.
          </p>
        </div>
        <span class="section-tag">Mini cards</span>
      </div>

      <div class="mini-card-grid">
        ${ordered
          .map((variant) => {
            const hasRequest = variant.requestedQuantity > 0;

            return `
              <article class="mini-card ${hasRequest ? "mini-card-active" : ""}">
                <div class="mini-card-top">
                  <div>
                    <p class="mini-color">${escapeHtml(variant.color)}</p>
                    <p class="mini-size">${escapeHtml(variant.size)}</p>
                  </div>
                  ${hasRequest ? '<span class="mini-badge">Pedido ativo</span>' : '<span class="mini-badge mini-badge-muted">Sem pedido</span>'}
                </div>

                <div class="mini-stat-grid">
                  <div class="mini-stat">
                    <span class="mini-stat-label">Estoque</span>
                    <strong>${variant.currentStock ?? "-"}</strong>
                  </div>
                  <div class="mini-stat">
                    <span class="mini-stat-label">Pedido</span>
                    <strong>${variant.requestedQuantity}</strong>
                  </div>
                </div>

                <div class="mini-sku">${escapeHtml(variant.sku)}</div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `.trim();
}

function renderDetailRows(variants: OrderVariant[]) {
  return sortVariants(variants)
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
}

export async function buildPurchaseOrderHtml(payload: PurchaseOrderPayload) {
  const template = resolveTemplate(payload.variants);
  const [embeddedImage, embeddedLogo] = await Promise.all([
    toDataUrl(payload.imageUrl),
    toDataUrl("/brand/pepper-logo.png")
  ]);

  const imageForHero = embeddedImage ?? embeddedLogo;
  const totalRequested = payload.variants.reduce((sum, variant) => sum + variant.requestedQuantity, 0);
  const totalCurrentStock = payload.variants.reduce((sum, variant) => sum + (variant.currentStock ?? 0), 0);
  const requestedVariants = payload.variants.filter((variant) => variant.requestedQuantity > 0);
  const zeroStockCount = payload.variants.filter((variant) => (variant.currentStock ?? 0) <= 0).length;
  const lowStockCount = payload.variants.filter((variant) => {
    const currentStock = variant.currentStock ?? 0;
    return currentStock > 0 && currentStock <= 5;
  }).length;
  const detailRows = renderDetailRows(payload.variants);
  const generationLabel = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date());
  const primarySection =
    template === "UNIQUE_COLOR_CARDS"
      ? renderUniqueCardsSection(payload.variants)
      : renderGridSection(payload.variants);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Solicitacao de Reposicao - ${escapeHtml(payload.productSku)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #14161b; color: #f8fafc; font-family: "Segoe UI", Arial, sans-serif; }
          @page { size: 210mm 297mm; margin: 10mm; }
          .page { max-width: 1160px; margin: 0 auto; padding: 28px; }
          .hero {
            padding: 28px;
            border-radius: 30px;
            border: 1px solid rgba(255,255,255,0.08);
            background:
              radial-gradient(circle at top right, rgba(249,115,22,0.24), transparent 32%),
              linear-gradient(135deg, #171b22 0%, #111827 46%, #1f2937 100%);
            box-shadow: 0 28px 60px rgba(7,10,18,0.32);
          }
          .hero-shell { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 28px; align-items: center; }
          .hero-logo { width: auto; max-width: 180px; max-height: 46px; object-fit: contain; display: block; }
          .hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 18px;
            padding: 8px 14px;
            border-radius: 999px;
            background: rgba(255,255,255,0.12);
            color: #fed7aa;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }
          .hero-title { margin: 18px 0 10px; font-size: 34px; line-height: 1.08; font-weight: 700; }
          .hero-copy { margin: 0; max-width: 760px; color: rgba(255,255,255,0.78); font-size: 15px; line-height: 1.7; }
          .hero-meta { margin-top: 20px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .hero-meta-card { border-radius: 22px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.06); padding: 16px; }
          .meta-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.52); }
          .meta-value { display: block; margin-top: 8px; font-size: 15px; font-weight: 600; color: #ffffff; }
          .hero-image-wrap { display: flex; justify-content: center; }
          .hero-image {
            width: 180px;
            height: 180px;
            object-fit: contain;
            border-radius: 28px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 12px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
          }
          .stats { margin-top: 20px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
          .stat { border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,247,242,0.06); padding: 16px; }
          .stat-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: rgba(255,255,255,0.56); }
          .stat-value { display: block; margin-top: 10px; font-size: 24px; font-weight: 700; color: #ffffff; }
          .content { margin-top: 22px; display: grid; gap: 18px; }
          .card { border-radius: 28px; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03)); padding: 22px; box-shadow: 0 22px 44px rgba(7,10,18,0.18); }
          .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
          .section-eyebrow { margin: 0; color: #fdba74; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
          .section-title { margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #ffffff; }
          .section-copy { margin: 10px 0 0; max-width: 760px; color: rgba(241,245,249,0.7); line-height: 1.7; font-size: 14px; }
          .section-tag { display: inline-flex; align-items: center; border-radius: 999px; padding: 8px 13px; background: rgba(255,255,255,0.08); color: #fde68a; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap; }
          .mini-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
          .mini-card { border-radius: 22px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.05); padding: 16px; }
          .mini-card-active { border-color: rgba(251,146,60,0.4); background: linear-gradient(180deg, rgba(255,243,224,0.12), rgba(255,255,255,0.05)); }
          .mini-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
          .mini-color { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; }
          .mini-size { margin: 6px 0 0; color: #fdba74; font-size: 15px; font-weight: 600; }
          .mini-badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 6px 10px; background: rgba(249,115,22,0.18); color: #fdba74; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap; }
          .mini-badge-muted { background: rgba(148,163,184,0.14); color: #cbd5e1; }
          .mini-stat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
          .mini-stat { border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); background: rgba(15,23,42,0.28); padding: 12px; }
          .mini-stat-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: rgba(241,245,249,0.52); }
          .mini-stat strong { display: block; margin-top: 8px; font-size: 24px; color: #ffffff; }
          .mini-sku { margin-top: 12px; border-radius: 16px; background: rgba(15,23,42,0.36); padding: 10px 12px; color: rgba(241,245,249,0.7); font-size: 12px; font-weight: 600; word-break: break-all; }
          .matrix-shell { overflow-x: auto; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); background: rgba(15,23,42,0.3); }
          .matrix-table { width: 100%; min-width: 740px; border-collapse: collapse; }
          .matrix-header, .matrix-table tbody th, .matrix-table tbody td { border-bottom: 1px solid rgba(255,255,255,0.08); border-right: 1px solid rgba(255,255,255,0.08); padding: 14px; vertical-align: top; }
          .matrix-header { background: rgba(255,255,255,0.06); color: rgba(241,245,249,0.72); font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; text-align: center; }
          .matrix-header-sticky { min-width: 220px; text-align: left; }
          .matrix-color { display: flex; align-items: center; min-height: 100%; }
          .matrix-color-name { font-size: 20px; font-weight: 700; color: #ffffff; text-align: left; }
          .matrix-size { font-size: 14px; font-weight: 700; color: #ffffff; }
          .matrix-cell { min-height: 128px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.05); padding: 12px; }
          .matrix-cell-active { border-color: rgba(251,146,60,0.42); background: linear-gradient(180deg, rgba(255,243,224,0.12), rgba(255,255,255,0.05)); }
          .matrix-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: rgba(241,245,249,0.5); }
          .matrix-qty { display: block; margin-top: 8px; font-size: 30px; font-weight: 700; color: #ffffff; }
          .matrix-stock, .matrix-sku { margin: 8px 0 0; font-size: 12px; color: rgba(241,245,249,0.7); }
          .matrix-sku { word-break: break-all; }
          .matrix-empty { min-height: 128px; display: grid; place-items: center; border-radius: 18px; border: 1px dashed rgba(255,255,255,0.12); color: rgba(241,245,249,0.3); font-size: 16px; }
          .detail-table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 22px; border: 1px solid rgba(255,255,255,0.08); }
          .detail-table th, .detail-table td { padding: 13px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; }
          .detail-table th { background: rgba(255,255,255,0.06); color: rgba(241,245,249,0.66); font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; }
          .detail-table td { background: rgba(15,23,42,0.24); color: #ffffff; font-size: 14px; }
          .note-box { margin-top: 18px; border-radius: 22px; border: 1px solid rgba(251,191,36,0.18); background: rgba(251,191,36,0.08); padding: 18px; }
          .note-box strong { display: block; color: #fde68a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; }
          .note-box p { margin: 10px 0 0; color: rgba(255,255,255,0.82); line-height: 1.7; font-size: 14px; }
          .footer-copy { margin-top: 18px; color: rgba(241,245,249,0.58); font-size: 12px; line-height: 1.8; }
          @media (max-width: 960px) {
            .page { padding: 18px; }
            .hero-shell { grid-template-columns: 1fr; }
            .hero-image-wrap { justify-content: flex-start; }
            .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .mini-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
          @media (max-width: 640px) {
            .page { padding: 14px; }
            .hero { padding: 20px; }
            .hero-title { font-size: 28px; }
            .hero-meta { grid-template-columns: 1fr; }
            .stats { grid-template-columns: 1fr 1fr; }
            .section-head { flex-direction: column; }
            .mini-card-grid { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <section class="hero">
            <div class="hero-shell">
              <div>
                ${embeddedLogo ? `<img class="hero-logo" src="${embeddedLogo}" alt="Pepper" />` : ""}
                <span class="hero-badge">Solicitacao portatil em base64</span>
                <h1 class="hero-title">${escapeHtml(payload.productName)}</h1>
                <p class="hero-copy">
                  Documento gerado pelo portal do Grupo Pepper para leitura rapida fora do sistema.
                  Logo e imagem seguem embutidas em base64 para manter o arquivo completo no download.
                </p>

                <div class="hero-meta">
                  <div class="hero-meta-card">
                    <span class="meta-label">Fornecedor</span>
                    <span class="meta-value">${escapeHtml(payload.supplierName)}</span>
                  </div>
                  <div class="hero-meta-card">
                    <span class="meta-label">SKU pai</span>
                    <span class="meta-value">${escapeHtml(payload.productSku)}</span>
                  </div>
                  <div class="hero-meta-card">
                    <span class="meta-label">Gerado em</span>
                    <span class="meta-value">${generationLabel}</span>
                  </div>
                  <div class="hero-meta-card">
                    <span class="meta-label">Modelo</span>
                    <span class="meta-value">${template === "UNIQUE_COLOR_CARDS" ? "Mini cards por cor" : "Grade cor x tamanho"}</span>
                  </div>
                </div>

                <div class="stats">
                  <div class="stat">
                    <span class="stat-label">Variacoes no pedido</span>
                    <span class="stat-value">${requestedVariants.length}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Qtde total</span>
                    <span class="stat-value">${totalRequested}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Saldo geral</span>
                    <span class="stat-value">${totalCurrentStock}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Cores zeradas</span>
                    <span class="stat-value">${zeroStockCount}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Baixo saldo</span>
                    <span class="stat-value">${lowStockCount}</span>
                  </div>
                </div>
              </div>

              <div class="hero-image-wrap">
                ${imageForHero ? `<img class="hero-image" src="${imageForHero}" alt="${escapeHtml(payload.productName)}" />` : ""}
              </div>
            </div>
          </section>

          <div class="content">
            ${primarySection}
            <section class="card">
              <div class="section-head">
                <div>
                  <p class="section-eyebrow">Auditoria rapida</p>
                  <h2 class="section-title">Lista completa das variacoes</h2>
                  <p class="section-copy">
                    Tabela de apoio para conferencia fina. Aqui ficam todas as variacoes recebidas no modal, inclusive as que ficaram sem quantidade sugerida.
                  </p>
                </div>
                <span class="section-tag">Resumo tecnico</span>
              </div>

              <table class="detail-table">
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
                  ${detailRows || '<tr><td colspan="5">Nenhuma variacao disponivel.</td></tr>'}
                </tbody>
              </table>

              ${
                payload.note?.trim()
                  ? `
                    <div class="note-box">
                      <strong>Observacao</strong>
                      <p>${escapeHtml(payload.note.trim())}</p>
                    </div>
                  `
                  : ""
              }

              <p class="footer-copy">
                Origem: Pepper IA | Fluxo: Grupo Pepper | Arquivo pensado para compartilhamento e impressao.
              </p>
            </section>
          </div>
        </div>
      </body>
    </html>
  `.trim();
}
