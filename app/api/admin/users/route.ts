import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { createLocalUser, updateLocalUser } from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { getRouteSession } from "@/lib/route-session";
import { isLocalOperationalMode } from "@/lib/runtime-mode";

const createSchema = z.object({
  username: z.string().min(3, "Informe um usuario com pelo menos 3 caracteres."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
  role: z.enum(["ADMIN", "SUPPLIER"]),
  supplierId: z.string().nullable().optional(),
  active: z.boolean().optional().default(true)
});

const updateSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(3, "Informe um usuario com pelo menos 3 caracteres."),
  password: z.string().optional(),
  role: z.enum(["ADMIN", "SUPPLIER"]),
  supplierId: z.string().nullable().optional(),
  active: z.boolean()
});

export async function POST(request: Request) {
  const session = await getRouteSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = createSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? "Dados invalidos." }, { status: 400 });
  }

  if (body.data.role === "SUPPLIER" && !body.data.supplierId) {
    return NextResponse.json({ error: "Usuario de fornecedor precisa estar vinculado a um fornecedor." }, { status: 400 });
  }

  try {
    if (isLocalOperationalMode()) {
      const user = await createLocalUser({
        username: body.data.username,
        password: body.data.password,
        role: body.data.role,
        supplierId: body.data.role === "SUPPLIER" ? body.data.supplierId ?? null : null,
        active: body.data.active
      });

      return NextResponse.json({ ok: true, userId: user.id, verification: { storedInFoundation: true } });
    }

    const user = await prisma.user.create({
      data: {
        username: body.data.username.trim().toLowerCase(),
        passwordHash: hashPassword(body.data.password),
        role: body.data.role,
        supplierId: body.data.role === "SUPPLIER" ? body.data.supplierId ?? null : null,
        active: body.data.active
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "user.create",
        entityType: "User",
        entityId: user.id,
        metadata: JSON.stringify({ username: user.username, role: user.role, supplierId: user.supplierId })
      }
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel criar o usuario.";
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

  if (body.data.role === "SUPPLIER" && !body.data.supplierId) {
    return NextResponse.json({ error: "Usuario de fornecedor precisa estar vinculado a um fornecedor." }, { status: 400 });
  }

  try {
    if (isLocalOperationalMode()) {
      await updateLocalUser({
        id: body.data.id,
        username: body.data.username,
        role: body.data.role,
        supplierId: body.data.role === "SUPPLIER" ? body.data.supplierId ?? null : null,
        active: body.data.active
      });

      return NextResponse.json({ ok: true, verification: { storedInFoundation: true } });
    }

    const user = await prisma.user.update({
      where: { id: body.data.id },
      data: {
        username: body.data.username.trim().toLowerCase(),
        role: body.data.role,
        supplierId: body.data.role === "SUPPLIER" ? body.data.supplierId ?? null : null,
        active: body.data.active,
        ...(body.data.password && body.data.password.trim().length > 0
          ? {
              passwordHash: hashPassword(body.data.password)
            }
          : {})
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "user.update",
        entityType: "User",
        entityId: user.id,
        metadata: JSON.stringify({ username: user.username, role: user.role, supplierId: user.supplierId, active: user.active })
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel atualizar o usuario.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
