import { NextResponse } from "next/server";

import { buildTinyWebhookPingResponse, handleTinySalesWebhookRequest } from "@/lib/tiny-sales-webhook-route";

export async function GET() {
  return buildTinyWebhookPingResponse("sales", "onshop");
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: Request) {
  return handleTinySalesWebhookRequest(request, "onshop", "sales");
}
