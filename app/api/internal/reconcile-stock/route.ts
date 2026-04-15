import { NextResponse } from "next/server";
import { z } from "zod";

import { reconcileVariantInventory } from "@/lib/tiny-stock-events";

const querySchema = z.object({
  force: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  staleMinutes: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined)),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
});

function isAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return false;
  }

  const url = new URL(request.url);
  const secret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret");

  return secret === configuredSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Reconciliacao nao autorizada." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const result = await reconcileVariantInventory({
    force: parsed.data.force,
    staleMinutes: parsed.data.staleMinutes,
    limit: parsed.data.limit
  });

  return NextResponse.json(result);
}
