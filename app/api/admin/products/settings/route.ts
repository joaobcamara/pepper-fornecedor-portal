import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

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

async function resolveValidSupplierIds(supplierIds: string[]) {
  if (supplierIds.length === 0) {
    return [];
  }

  const suppliers = await prisma.supplier.findMany({
    where: {
      id: {
        in: supplierIds
      },
      active: true
    },
    select: {
      id: true
    }
  });

  return suppliers.map((supplier) => supplier.id);
}

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Dados invalidos para atualizar o produto." }, { status: 400 });
  }

  const validSupplierIds = await resolveValidSupplierIds(body.data.supplierIds);

  if (body.data.supplierIds.length > 0 && validSupplierIds.length === 0) {
    return NextResponse.json({ error: "Nenhum fornecedor ativo valido foi encontrado para este produto." }, { status: 400 });
  }

  const [parent, catalogProduct] = await Promise.all([
    prisma.product.findUnique({
      where: {
        sku: body.data.parentSku
      },
      include: {
        variants: {
          select: {
            id: true,
            archivedAt: true
          }
        }
      }
    }),
    prisma.catalogProduct.findUnique({
      where: {
        skuParent: body.data.parentSku
      },
      include: {
        supplierLinks: true,
        variants: {
          select: {
            id: true,
            sourceProductId: true
          }
        }
      }
    })
  ]);

  if (!parent && !catalogProduct) {
    return NextResponse.json({ error: "Produto pai nao encontrado." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    if (catalogProduct) {
      await tx.catalogProduct.update({
        where: {
          id: catalogProduct.id
        },
        data: {
          name: body.data.internalName,
          active: body.data.active,
          archivedAt: body.data.active ? null : catalogProduct.archivedAt ?? new Date()
        }
      });

      await tx.catalogVariant.updateMany({
        where: {
          catalogProductId: catalogProduct.id
        },
        data: {
          active: body.data.active
        }
      });

      const existingLinks = new Map(catalogProduct.supplierLinks.map((link) => [link.supplierId, link.id] as const));

      for (const supplierId of validSupplierIds) {
        const existingLinkId = existingLinks.get(supplierId);

        if (existingLinkId) {
          await tx.catalogProductSupplier.update({
            where: {
              id: existingLinkId
            },
            data: {
              active: true
            }
          });
        } else {
          await tx.catalogProductSupplier.create({
            data: {
              catalogProductId: catalogProduct.id,
              supplierId,
              active: true
            }
          });
        }
      }

      for (const link of catalogProduct.supplierLinks) {
        if (!validSupplierIds.includes(link.supplierId)) {
          await tx.catalogProductSupplier.update({
            where: {
              id: link.id
            },
            data: {
              active: false
            }
          });
        }
      }
    }

    if (parent) {
      await tx.product.update({
        where: {
          id: parent.id
        },
        data: {
          internalName: body.data.internalName,
          active: body.data.active,
          archivedAt: body.data.active ? null : parent.archivedAt ?? new Date()
        }
      });
    }

    for (const variant of catalogProduct?.variants ?? []) {
      if (!variant.sourceProductId) {
        continue;
      }

      await tx.product.update({
        where: {
          id: variant.sourceProductId
        },
        data: {
          active: body.data.active,
          archivedAt: body.data.active ? null : new Date()
        }
      });
    }

    for (const variant of parent?.variants ?? []) {
      await tx.product.update({
        where: {
          id: variant.id
        },
        data: {
          active: body.data.active,
          archivedAt: body.data.active ? null : variant.archivedAt ?? new Date()
        }
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "product.settings.update",
        entityType: "catalog_product",
        entityId: catalogProduct?.id ?? parent?.id ?? body.data.parentSku,
        metadata: JSON.stringify({
          parentSku: body.data.parentSku,
          active: body.data.active,
          supplierIds: validSupplierIds
        })
      }
    });
  });

  return NextResponse.json({
    ok: true,
    verification: {
      storedInFoundation: true,
      visibleForSupplier: body.data.active && validSupplierIds.length > 0
    }
  });
}
