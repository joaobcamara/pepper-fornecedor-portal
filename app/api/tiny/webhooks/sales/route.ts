import { NextResponse } from "next/server";

import { isTinyWebhookAuthorized } from "@/lib/tiny-stock-events";
import { handleTinySalesWebhook } from "@/lib/tiny-sales-events";
import type { TinyAccountKey } from "@/lib/tiny";

async function parseWebhookPayload(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(rawBody);
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const payload = params.get("payload") ?? params.get("data");

    if (payload) {
      try {
        return JSON.parse(payload);
      } catch {
        return Object.fromEntries(params.entries());
      }
    }

    return Object.fromEntries(params.entries());
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function getTinySalesAccountKey(request: Request): TinyAccountKey {
  const url = new URL(request.url);
  const rawValue =
    request.headers.get("x-tiny-account") ??
    request.headers.get("x-account-key") ??
    url.searchParams.get("account") ??
    url.searchParams.get("empresa") ??
    "pepper";

  const normalized = rawValue.trim().toLowerCase();

  if (normalized === "showlook" || normalized === "show-look" || normalized === "show_look") {
    return "showlook";
  }

  if (normalized === "onshop" || normalized === "on-shop" || normalized === "on_shopp" || normalized === "on_shop") {
    return "onshop";
  }

  return "pepper";
}

export async function POST(request: Request) {
  if (!isTinyWebhookAuthorized(request)) {
    return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
  }

  const payload = await parseWebhookPayload(request).catch(() => null);

  if (!payload) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  try {
    const result = await handleTinySalesWebhook(payload, getTinySalesAccountKey(request));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao processar webhook de vendas."
      },
      { status: 400 }
    );
  }
}
