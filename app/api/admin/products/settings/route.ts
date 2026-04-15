import { NextResponse } from "next/server";
import { z } from "zod";
import { syncCatalogProductByParentSku } from "@/lib/catalog-sync";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  parentSku: z.string().min(1),
  internalName: z.string().min(1),
  active: z.boolean(),
  supplierIds: z.array(z.string().min(1)).default([]),
  criticalStockThreshold: z.number().int().min(0).nullable(),
  lowStockThreshold: z.number().int().min(0).nullable(),
  variantThresholds: z
    .array(
      z.object({
        sku: z.string().min(1),
        criticalStockThreshold: z.number().int().min(0).nullable(),
        lowStockThreshold: z.number().int().min(0).nullable()
      })
    )
    .default([])
});

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Dados inválidos para atualizar o produto." }, { status: 400 });
  }

  const parent = await prisma.product.findUnique({
    where: {
      sku: body.data.parentSku
    },
    include: {
      variants: {
        include: {
          assignments: true
        }
      }
    }
  });

  if (!parent) {
    return NextResponse.json({ error: "Produto pai não encontrado." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: {
        id: parent.id
      },
      data: {
        internalName: body.data.internalName,
        active: body.data.active
      }
    });

    for (const variant of parent.variants) {
      await tx.product.update({
        where: {
          id: variant.id
        },
        data: {
          active: body.data.active
        }
      });

      const existingAssignments = new Map(variant.assignments.map((assignment) => [assignment.supplierId, assignment]));

      for (const supplierId of body.data.supplierIds) {
        const existing = existingAssignments.get(supplierId);

        if (existing) {
          await tx.productSupplier.update({
            where: {
              id: existing.id
            },
            data: {
              active: true
            }
          });
        } else {
          await tx.productSupplier.create({
            data: {
              productId: variant.id,
              supplierId,
              active: true
            }
          });
        }
      }

      for (const assignment of variant.assignments) {
        if (!body.data.supplierIds.includes(assignment.supplierId)) {
          await tx.productSupplier.update({
            where: {
              id: assignment.id
            },
            data: {
              active: false
            }
          });
        }
      }
    }

    await tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "product.settings.update",
        entityType: "product",
        entityId: parent.id,
        metadata: JSON.stringify({
          parentSku: body.data.parentSku,
          active: body.data.active,
          supplierIds: body.data.supplierIds
        })
      }
    });

    await syncCatalogProductByParentSku(tx, body.data.parentSku);
  });

  return NextResponse.json({
    ok: true
  });
}
