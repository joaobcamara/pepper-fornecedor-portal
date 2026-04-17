import { NextResponse } from "next/server";

import {
  buildTinyWebhookPingResponse,
  handleTinySalesWebhookRequest,
  resolveTinyWebhookAccountKey
} from "@/lib/tiny-sales-webhook-route";

export async function GET(request: Request) {
  return buildTinyWebhookPingResponse("sales", resolveTinyWebhookAccountKey(request));
}

export async function HEAD(request: Request) {
  void request;
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: Request) {
  return handleTinySalesWebhookRequest(request, undefined, "sales");
}
