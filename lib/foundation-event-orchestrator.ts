import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { TinyAccountKey } from "@/lib/tiny";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function toStableJson(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toStableJson(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, toStableJson(item)])
    );
  }

  return String(value);
}

function stableStringify(value: unknown) {
  return JSON.stringify(toStableJson(value));
}

export function createFoundationEventFingerprint(input: {
  webhookType: string;
  accountKey: TinyAccountKey | string;
  eventType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload: unknown;
}) {
  return createHash("sha256")
    .update(
      stableStringify({
        webhookType: input.webhookType,
        accountKey: input.accountKey,
        eventType: input.eventType ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        payload: input.payload
      })
    )
    .digest("hex");
}

type BeginFoundationWebhookParams = {
  webhookType: string;
  accountKey: TinyAccountKey | string;
  eventType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  sku?: string | null;
  tinyProductId?: string | null;
  payload: unknown;
};

export async function beginFoundationWebhookProcessing(params: BeginFoundationWebhookParams) {
  const fingerprint = createFoundationEventFingerprint(params);

  const existing = await prisma.tinyWebhookLog.findFirst({
    where: {
      webhookType: params.webhookType,
      accountKey: params.accountKey,
      fingerprint,
      status: {
        in: ["processed", "duplicate", "variant_not_found", "missing_order_id"]
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      status: true
    }
  });

  if (existing) {
    const duplicateLog = await prisma.tinyWebhookLog.create({
      data: {
        webhookType: params.webhookType,
        accountKey: params.accountKey,
        eventType: params.eventType ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        sku: params.sku ?? null,
        tinyProductId: params.tinyProductId ?? null,
        fingerprint,
        duplicateOfId: existing.id,
        status: "duplicate",
        processingStage: "deduplicated",
        payload: stableStringify(params.payload),
        processedAt: new Date(),
        errorMessage: `Evento repetido reaproveitou o processamento ${existing.id}.`
      }
    });

    return {
      duplicate: true as const,
      logId: duplicateLog.id,
      duplicateOfId: existing.id,
      fingerprint
    };
  }

  const log = await prisma.tinyWebhookLog.create({
    data: {
      webhookType: params.webhookType,
      accountKey: params.accountKey,
      eventType: params.eventType ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      sku: params.sku ?? null,
      tinyProductId: params.tinyProductId ?? null,
      fingerprint,
      status: "received",
      processingStage: "received",
      payload: stableStringify(params.payload)
    }
  });

  return {
    duplicate: false as const,
    logId: log.id,
    fingerprint
  };
}

type FinalizeFoundationWebhookParams = {
  logId: string;
  status: string;
  processingStage: string;
  processedAt?: Date | null;
  errorMessage?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  sku?: string | null;
  tinyProductId?: string | null;
  payload?: unknown;
};

export async function finalizeFoundationWebhookProcessing(params: FinalizeFoundationWebhookParams) {
  await prisma.tinyWebhookLog.update({
    where: {
      id: params.logId
    },
    data: {
      status: params.status,
      processingStage: params.processingStage,
      processedAt: params.processedAt ?? new Date(),
      errorMessage: params.errorMessage ?? null,
      entityType: params.entityType ?? undefined,
      entityId: params.entityId ?? undefined,
      sku: params.sku ?? undefined,
      tinyProductId: params.tinyProductId ?? undefined,
      payload: params.payload !== undefined ? stableStringify(params.payload) : undefined
    }
  });
}

type CreateFoundationSyncRunParams = {
  triggerType: string;
  scope: string;
  status: string;
  accountKey?: TinyAccountKey | string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: unknown;
  requestedByUserId?: string | null;
};

export async function createFoundationSyncRun(params: CreateFoundationSyncRunParams) {
  return prisma.syncRun.create({
    data: {
      triggerType: params.triggerType,
      scope: params.scope,
      accountKey: params.accountKey ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      status: params.status,
      metadata: params.metadata === undefined ? null : stableStringify(params.metadata),
      requestedByUserId: params.requestedByUserId ?? null
    }
  });
}

export async function finalizeFoundationSyncRun(params: {
  runId: string;
  status: string;
  errorMessage?: string | null;
  metadata?: unknown;
}) {
  await prisma.syncRun.update({
    where: {
      id: params.runId
    },
    data: {
      status: params.status,
      finishedAt: new Date(),
      errorMessage: params.errorMessage ?? null,
      metadata: params.metadata === undefined ? undefined : stableStringify(params.metadata)
    }
  });
}
