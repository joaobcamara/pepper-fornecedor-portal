import { NextResponse } from "next/server";
import { z } from "zod";
import { createLocalSupplier, updateLocalSupplier } from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { getRouteSession } from "@/lib/route-session";
import { isLocalOperationalMode } from "@/lib/runtime-mode";

const logoSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || value.startsWith("/") || /^https?:\/\//.test(value), "Informe uma logo valida.");

const createSchema = z.object({
  name: z.string().min(2, "Informe o nome do fornecedor."),
  slug: z.string().min(2, "Informe o slug do fornecedor."),
  logoUrl: logoSchema,
  contactName: z.string().trim().optional().or(z.literal("")),
  contactPhone: z.string().trim().optional().or(z.literal("")),
  contactEmail: z.string().trim().email("Informe um email valido.").optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  active: z.boolean().optional().default(true),
  canViewProductValues: z.boolean().optional().default(false),
  canViewFinancialDashboard: z.boolean().optional().default(false)
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Informe o nome do fornecedor."),
  slug: z.string().min(2, "Informe o slug do fornecedor."),
  logoUrl: logoSchema,
  contactName: z.string().trim().optional().or(z.literal("")),
  contactPhone: z.string().trim().optional().or(z.literal("")),
  contactEmail: z.string().trim().email("Informe um email valido.").optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  active: z.boolean(),
  canViewProductValues: z.boolean(),
  canViewFinancialDashboard: z.boolean()
});

const deleteSchema = z.object({
  id: z.string().min(1)
});

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  const session = await getRouteSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = createSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? "Dados invalidos." }, { status: 400 });
  }

  const slug = normalizeSlug(body.data.slug);

  try {
    if (isLocalOperationalMode()) {
      const supplier = await createLocalSupplier({
        name: body.data.name.trim(),
        slug,
        logoUrl: body.data.logoUrl?.trim() || null,
        contactName: body.data.contactName?.trim() || null,
        contactPhone: body.data.contactPhone?.trim() || null,
        contactEmail: body.data.contactEmail?.trim() || null,
        address: body.data.address?.trim() || null,
        active: body.data.active,
        canViewProductValues: body.data.canViewProductValues,
        canViewFinancialDashboard: body.data.canViewFinancialDashboard
      });

      return NextResponse.json({ ok: true, supplierId: supplier.id });
    }

    const supplier = await prisma.supplier.create({
        data: {
          name: body.data.name.trim(),
          slug,
          logoUrl: body.data.logoUrl?.trim() || null,
          contactName: body.data.contactName?.trim() || null,
          contactPhone: body.data.contactPhone?.trim() || null,
          contactEmail: body.data.contactEmail?.trim() || null,
          address: body.data.address?.trim() || null,
          active: body.data.active,
          canViewProductValues: body.data.canViewProductValues,
          canViewFinancialDashboard: body.data.canViewFinancialDashboard
        }
      });

    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "supplier.create",
        entityType: "Supplier",
        entityId: supplier.id,
        metadata: JSON.stringify({ slug: supplier.slug, name: supplier.name })
      }
    });

    return NextResponse.json({ ok: true, supplierId: supplier.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel criar o fornecedor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getRouteSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = updateSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? "Dados invalidos." }, { status: 400 });
  }

  const slug = normalizeSlug(body.data.slug);

  try {
    if (isLocalOperationalMode()) {
      await updateLocalSupplier({
        id: body.data.id,
        name: body.data.name.trim(),
        slug,
        logoUrl: body.data.logoUrl?.trim() || null,
        contactName: body.data.contactName?.trim() || null,
        contactPhone: body.data.contactPhone?.trim() || null,
        contactEmail: body.data.contactEmail?.trim() || null,
        address: body.data.address?.trim() || null,
        active: body.data.active,
        canViewProductValues: body.data.canViewProductValues,
        canViewFinancialDashboard: body.data.canViewFinancialDashboard
      });

      return NextResponse.json({ ok: true });
    }

    const supplier = await prisma.supplier.update({
      where: { id: body.data.id },
        data: {
          name: body.data.name.trim(),
          slug,
          logoUrl: body.data.logoUrl?.trim() || null,
          contactName: body.data.contactName?.trim() || null,
          contactPhone: body.data.contactPhone?.trim() || null,
          contactEmail: body.data.contactEmail?.trim() || null,
          address: body.data.address?.trim() || null,
          active: body.data.active,
          canViewProductValues: body.data.canViewProductValues,
          canViewFinancialDashboard: body.data.canViewFinancialDashboard
        }
      });

    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "supplier.update",
        entityType: "Supplier",
        entityId: supplier.id,
        metadata: JSON.stringify({
          slug: supplier.slug,
          name: supplier.name,
          contactName: supplier.contactName,
          contactPhone: supplier.contactPhone,
          contactEmail: supplier.contactEmail,
          address: supplier.address,
          active: supplier.active,
          canViewProductValues: supplier.canViewProductValues,
          canViewFinancialDashboard: supplier.canViewFinancialDashboard
        })
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel atualizar o fornecedor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getRouteSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = deleteSchema.safeParse(await request.json().catch(() => ({})));

  if (!body.success) {
    return NextResponse.json({ error: "Fornecedor invalido." }, { status: 400 });
  }

  if (isLocalOperationalMode()) {
    return NextResponse.json({ error: "Exclusao indisponivel no modo local." }, { status: 400 });
  }

  try {
    const usage = await prisma.supplier.findUnique({
      where: { id: body.data.id },
      select: {
        id: true,
        name: true,
        slug: true,
        users: { select: { id: true }, take: 1 },
        supplierOrders: { select: { id: true }, take: 1 },
        replenishmentRequests: { select: { id: true }, take: 1 },
        catalogProducts: { select: { id: true } }
      }
    });

    if (!usage) {
      return NextResponse.json({ error: "Fornecedor nao encontrado." }, { status: 404 });
    }

    const hasDependencies =
      usage.users.length > 0 || usage.supplierOrders.length > 0 || usage.replenishmentRequests.length > 0;

    if (hasDependencies) {
      await prisma.$transaction(async (tx) => {
        await tx.catalogProductSupplier.updateMany({
          where: { supplierId: usage.id },
          data: { active: false }
        });

        await tx.supplier.update({
          where: { id: usage.id },
          data: {
            active: false
          }
        });

        await tx.auditLog.create({
          data: {
            actorUserId: session.userId,
            action: "supplier.archive",
            entityType: "Supplier",
            entityId: usage.id,
            metadata: JSON.stringify({
              slug: usage.slug,
              name: usage.name,
              reason: "dependencies_detected"
            })
          }
        });
      });

      return NextResponse.json({ ok: true, mode: "archived" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.catalogProductSupplier.deleteMany({
        where: { supplierId: usage.id }
      });

      await tx.supplier.delete({
        where: { id: usage.id }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: "supplier.delete",
          entityType: "Supplier",
          entityId: usage.id,
          metadata: JSON.stringify({
            slug: usage.slug,
            name: usage.name
          })
        }
      });
    });

    return NextResponse.json({ ok: true, mode: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel excluir o fornecedor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
