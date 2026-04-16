import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encodeSession, getSessionCookieName, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timeoutId: NodeJS.Timeout | null = null;

  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    })
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  next: z.string().default("/produtos")
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Preencha usuario e senha." }, { status: 400 });
  }

  const body = bodySchema.safeParse(payload);

  if (!body.success) {
    return NextResponse.json({ error: "Preencha usuario e senha." }, { status: 400 });
  }

  let user = null;
  const requestUrl = new URL(request.url);
  const isLocalPreviewHost = requestUrl.hostname === "127.0.0.1" || requestUrl.hostname === "localhost";
  const allowDemoAuth =
    process.env.ALLOW_DEMO_AUTH === "true" && (process.env.NODE_ENV !== "production" || isLocalPreviewHost);
  const shouldUseSecureCookie = process.env.NODE_ENV === "production" && !isLocalPreviewHost;

  try {
    user = await withTimeout(
      prisma.user.findUnique({
        where: {
          username: body.data.username
        }
      }),
      5000,
      "login_lookup"
    );
  } catch {
    if (!allowDemoAuth) {
      return NextResponse.json({ error: "Login indisponivel no momento. Tente novamente em instantes." }, { status: 503 });
    }

    const { demoUsers } = await import("@/lib/demo-data");
    user = demoUsers.find((entry) => entry.username === body.data.username) ?? null;
  }

  if (!user || !user.active || !verifyPassword(body.data.password, user.passwordHash)) {
    return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 });
  }

  const requestedNext = body.data.next;
  const redirectTo =
    user.role === "ADMIN"
      ? requestedNext.startsWith("/admin")
        ? requestedNext
        : "/admin"
      : requestedNext.startsWith("/admin")
        ? "/produtos"
        : requestedNext || "/produtos";
  const session = encodeSession({
    userId: user.id,
    role: user.role,
    supplierId: user.supplierId,
    username: user.username
  });

  const store = await cookies();
  store.set(getSessionCookieName(), session, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie,
    path: "/",
    maxAge: 60 * 60 * 12
  });

  try {
    await withTimeout(
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      }),
      3000,
      "login_touch"
    );
  } catch {
    // Local preview may run on a degraded SQLite file; login should still succeed.
  }

  return NextResponse.json({ redirectTo });
}


