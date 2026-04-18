import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getRouteSession } from "@/lib/route-session";
import { isLocalOperationalMode } from "@/lib/runtime-mode";

const createSchema = z.object({
  supplierId: z.string().min(1),
  catalogProductId: z.string().min(1)
});

const updateSchema = z.object({
  linkId: z.string().min(1),
  active: z.boolean(),
  supplierSalePrice: z.number().nonnegative().nullable().optional(),
  criticalStockThreshold: z.number().int().min(0).nullable().optional(),
  lowStockThreshold: z.number().int().min(0).nullable().optional()
});

const deleteSchema = z.object({
  linkId: z.string().min(1)
});

async function ensureAdmin() {
  const session = await getRouteSession();

  if (!session || session.role !== "ADMIN") {
    return null;
  }

  return session;
}

export async function POST(request: Request) {
  const session = await ensureAdmin();

  if (!session) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  if (isLocalOperationalMode()) {
    return NextResponse.json({ error: "Vinculo de produto indisponivel no modo local." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos para vincular produto." }, { status: 400 });
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: parsed.data.supplierId },
    select: { id: true, active: true }
  });
  const catalogProduct = await prisma.catalogProduct.findUnique({
    where: { id: parsed.data.catalogProductId },
    select: { id: true, active: true, archivedAt: true }
  });

  if (!supplier?.id || !supplier.active) {
    return NextResponse.json({ error: "Fornecedor invalido ou inativo." }, { status: 404 });
  }

  if (!catalogProduct?.id || !catalogProduct.active || catalogProduct.archivedAt) {
    return NextResponse.json({ error: "Produto invalido ou inativo." }, { status: 404 });
  }

  const link = await prisma.catalogProductSupplier.upsert({
    where: {
      catalogProductId_supplierId: {
        catalogProductId: parsed.data.catalogProductId,
        supplierId: parsed.data.supplierId
      }
    },
    update: {
      active: true
    },
    create: {
      catalogProductId: parsed.data.catalogProductId,
      supplierId: parsed.data.supplierId,
      active: true
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.userId,
      action: "supplier.product-link.create",
      entityType: "CatalogProductSupplier",
      entityId: link.id,
      metadata: JSON.stringify({
        supplierId: parsed.data.supplierId,
        catalogProductId: parsed.data.catalogProductId
      })
    }
  });

  return NextResponse.json({ ok: true, linkId: link.id });
}

export async function PATCH(request: Request) {
  const session = await ensureAdmin();

  if (!session) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  if (isLocalOperationalMode()) {
    return NextResponse.json({ error: "Ajuste de vinculo indisponivel no modo local." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos para atualizar o vinculo." }, { status: 400 });
  }

  if (
    parsed.data.criticalStockThreshold !== null &&
    parsed.data.lowStockThreshold !== null &&
    parsed.data.lowStockThreshold !== undefined &&
    parsed.data.criticalStockThreshold !== undefined &&
    parsed.data.lowStockThreshold < parsed.data.criticalStockThreshold
  ) {
    return NextResponse.json({ error: "O limite baixo nao pode ser menor que o critico." }, { status: 400 });
  }

  const link = await prisma.catalogProductSupplier.update({
    where: {
      id: parsed.data.linkId
    },
    data: {
      active: parsed.data.active,
      supplierSalePrice: parsed.data.supplierSalePrice ?? null,
      criticalStockThreshold: parsed.data.criticalStockThreshold ?? null,
      lowStockThreshold: parsed.data.lowStockThreshold ?? null
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.userId,
      action: "supplier.product-link.update",
      entityType: "CatalogProductSupplier",
      entityId: link.id,
      metadata: JSON.stringify({
        active: link.active,
        supplierSalePrice: link.supplierSalePrice,
        criticalStockThreshold: link.criticalStockThreshold,
        lowStockThreshold: link.lowStockThreshold
      })
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await ensureAdmin();

  if (!session) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  if (isLocalOperationalMode()) {
    return NextResponse.json({ error: "Remocao de vinculo indisponivel no modo local." }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos para remover o vinculo." }, { status: 400 });
  }

  const existing = await prisma.catalogProductSupplier.findUnique({
    where: { id: parsed.data.linkId },
    select: {
      id: true,
      supplierId: true,
      catalogProductId: true
    }
  });

  if (!existing) {
    return NextResponse.json({ error: "Vinculo nao encontrado." }, { status: 404 });
  }

  await prisma.catalogProductSupplier.delete({
    where: { id: existing.id }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.userId,
      action: "supplier.product-link.delete",
      entityType: "CatalogProductSupplier",
      entityId: existing.id,
      metadata: JSON.stringify({
        supplierId: existing.supplierId,
        catalogProductId: existing.catalogProductId
      })
    }
  });

  return NextResponse.json({ ok: true });
}
