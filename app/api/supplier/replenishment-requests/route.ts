import { NextResponse } from "next/server";
import { z } from "zod";
import { createLocalReplenishmentRequest, getLocalSupplierDirectory } from "@/lib/local-operations-store";
import { buildPurchaseOrderHtml } from "@/lib/order-html";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
import { getCurrentSession } from "@/lib/session";

const itemSchema = z.object({
  sku: z.string().min(1),
  size: z.string().min(1),
  color: z.string().min(1),
  currentStock: z.number().nullable(),
  requestedQuantity: z.number().int().min(0)
});

const bodySchema = z.object({
  supplierName: z.string().min(1),
  productName: z.string().min(1),
  productSku: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  note: z.string().max(1000).optional(),
  variants: z.array(itemSchema)
});

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  try {
    const body = bodySchema.safeParse(await request.json());

    if (!body.success) {
      return NextResponse.json({ error: "Dados invalidos para enviar a solicitacao." }, { status: 400 });
    }

    const selectedItems = body.data.variants.filter((variant) => variant.requestedQuantity > 0);

    if (selectedItems.length === 0) {
      return NextResponse.json({ error: "Informe ao menos uma quantidade para enviar a solicitacao." }, { status: 400 });
    }

    if (isLocalOperationalMode()) {
      const html = await buildPurchaseOrderHtml(body.data).catch(() => `
        <html>
          <body>
            <h1>Solicitacao de Reposicao</h1>
            <p>Fornecedor: ${body.data.supplierName}</p>
            <p>Produto: ${body.data.productName}</p>
            <p>SKU: ${body.data.productSku}</p>
          </body>
        </html>
      `.trim());
      const localSuppliers = await getLocalSupplierDirectory();
      const resolvedSupplierId =
        (session.supplierId && localSuppliers.some((supplier) => supplier.id === session.supplierId) ? session.supplierId : null) ??
        localSuppliers.find((supplier) => supplier.active)?.id ??
        null;

      if (!resolvedSupplierId) {
        throw new Error("Nenhum fornecedor local ativo foi encontrado para registrar a solicitacao.");
      }

      const replenishmentRequest = await createLocalReplenishmentRequest({
        supplierId: resolvedSupplierId,
        createdByUserId: session.userId,
        createdByUsername: session.username,
        productName: body.data.productName,
        productSku: body.data.productSku,
        imageUrl: body.data.imageUrl ?? null,
        note: body.data.note?.trim() || null,
        htmlContent: html,
        items: selectedItems.map((variant) => ({
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          currentStock: variant.currentStock,
          requestedQuantity: variant.requestedQuantity
        }))
      });

      return NextResponse.json({
        ok: true,
        requestId: replenishmentRequest.id,
        verification: {
          storedInFoundation: true,
          visibleForAdmin: true
        }
      });
    }

    const html = await buildPurchaseOrderHtml(body.data);

    const normalizedSku = body.data.productSku.trim();
    const parentSku = normalizedSku.split("-").length >= 4 ? normalizedSku.split("-").slice(0, 2).join("-") : normalizedSku;

    const [catalogVariant, catalogProduct, product] = await Promise.all([
      prisma.catalogVariant.findUnique({
        where: {
          sku: normalizedSku
        },
        select: {
          sourceProductId: true
        }
      }),
      prisma.catalogProduct.findUnique({
        where: {
          skuParent: parentSku
        },
        select: {
          sourceProductId: true
        }
      }),
      prisma.product.findFirst({
        where: {
          OR: [{ sku: normalizedSku }, { sku: parentSku }]
        },
        select: {
          id: true
        }
      })
    ]);

    const productId = catalogVariant?.sourceProductId ?? catalogProduct?.sourceProductId ?? product?.id ?? null;

    const replenishmentRequest = await prisma.replenishmentRequest.create({
      data: {
        supplierId: session.supplierId,
        createdByUserId: session.userId,
        productId,
        productName: body.data.productName,
        productSku: body.data.productSku,
        imageUrl: body.data.imageUrl ?? null,
        note: body.data.note?.trim() || null,
        htmlContent: html,
        items: {
          create: selectedItems.map((variant) => ({
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            currentStock: variant.currentStock,
            requestedQuantity: variant.requestedQuantity
          }))
        }
      }
    });

    return NextResponse.json({
      ok: true,
      requestId: replenishmentRequest.id,
      verification: {
        storedInFoundation: true,
        visibleForAdmin: true
      }
    });
  } catch (error) {
    console.error("[supplier-replenishment]", error);
    return NextResponse.json(
      {
        error:
          isLocalOperationalMode() && error instanceof Error
            ? error.message
            : "Nao foi possivel registrar a solicitacao de reposicao agora."
      },
      { status: 503 }
    );
  }
}
