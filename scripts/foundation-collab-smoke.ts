import { MessageSenderRole, ProductSuggestionStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";

import {
  ensureConversationForSupplier,
  getAdminConversationList,
  getAdminConversationView,
  getSupplierConversationView
} from "../lib/chat-data";
import { prisma } from "../lib/prisma";
import { getAdminSuggestionCards, getSupplierSuggestions } from "../lib/suggestion-data-v2";

function log(message: string) {
  process.stdout.write(`${message}\n`);
}

async function main() {
  const adminUser = await prisma.user.findUnique({
    where: { username: "admin" }
  });
  const supplierUser = await prisma.user.findUnique({
    where: { username: "luna" }
  });

  if (!adminUser || !supplierUser || !supplierUser.supplierId) {
    throw new Error("Usuarios demo/admin do smoke nao estao disponiveis.");
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierUser.supplierId }
  });

  if (!supplier) {
    throw new Error("Fornecedor base do smoke nao encontrado.");
  }

  const conversation = await ensureConversationForSupplier(supplier.id);
  const tag = `smoke-${randomUUID().slice(0, 8)}`;
  const createdMessageIds: string[] = [];
  let createdSuggestionId: string | null = null;

  try {
    const adminMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: adminUser.id,
        senderRole: MessageSenderRole.ADMIN,
        body: `Mensagem admin ${tag}`
      }
    });
    createdMessageIds.push(adminMessage.id);

    const supplierMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: supplierUser.id,
        senderRole: MessageSenderRole.SUPPLIER,
        body: `Mensagem fornecedor ${tag}`
      }
    });
    createdMessageIds.push(supplierMessage.id);

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: supplierMessage.createdAt }
    });

    const [conversationList, adminConversation, supplierConversation] = await Promise.all([
      getAdminConversationList(),
      getAdminConversationView(conversation.id),
      getSupplierConversationView(supplierUser.id, supplier.id)
    ]);

    const conversationVisibleForAdmin = conversationList.some((item) => item.id === conversation.id);
    const conversationVisibleInAdminDetail = Boolean(
      adminConversation?.messages.some((message) => message.body.includes(tag))
    );
    const conversationVisibleForSupplier = supplierConversation.messages.some((message) =>
      message.body.includes(tag)
    );

    if (!conversationVisibleForAdmin || !conversationVisibleInAdminDetail || !conversationVisibleForSupplier) {
      throw new Error("Fluxo de conversa nao refletiu corretamente entre admin e fornecedor.");
    }

    log("[OK] Conversas refletem a fundacao para admin e fornecedor.");

    const suggestion = await prisma.productSuggestion.create({
      data: {
        supplierId: supplier.id,
        productName: `Produto smoke ${tag}`,
        price: 79.9,
        material: "Viscolycra",
        modelDescription: `Descricao automatica ${tag}`,
        status: ProductSuggestionStatus.NEW,
        images: {
          create: [
            {
              type: "FRONT",
              fileName: "pepper-logo.png",
              fileUrl: "/brand/pepper-logo.png"
            },
            {
              type: "BACK",
              fileName: "pepper-logo.png",
              fileUrl: "/brand/pepper-logo.png"
            }
          ]
        },
        sizes: {
          create: [{ label: "P" }, { label: "M" }]
        },
        colors: {
          create: [{ label: "Preto" }, { label: "Vermelho" }]
        },
        statusHistory: {
          create: {
            toStatus: ProductSuggestionStatus.NEW,
            note: `Sugestao criada no smoke ${tag}`,
            visibleToSupplier: true
          }
        }
      }
    });
    createdSuggestionId = suggestion.id;

    const [supplierSuggestions, adminSuggestionCards] = await Promise.all([
      getSupplierSuggestions(supplier.id),
      getAdminSuggestionCards()
    ]);

    const visibleForSupplier = supplierSuggestions.some((item) => item.id === suggestion.id);
    const visibleForAdmin = adminSuggestionCards.some((item) => item.id === suggestion.id);

    if (!visibleForSupplier || !visibleForAdmin) {
      throw new Error("Fluxo de sugestao nao refletiu corretamente entre fornecedor e admin.");
    }

    log("[OK] Sugestoes de produto refletem a fundacao para fornecedor e admin.");
    log("=== Smoke colaborativo concluido ===");
  } finally {
    if (createdSuggestionId) {
      await prisma.productSuggestionStatusHistory.deleteMany({
        where: { suggestionId: createdSuggestionId }
      }).catch(() => null);
      await prisma.productSuggestionImage.deleteMany({
        where: { suggestionId: createdSuggestionId }
      }).catch(() => null);
      await prisma.productSuggestionSize.deleteMany({
        where: { suggestionId: createdSuggestionId }
      }).catch(() => null);
      await prisma.productSuggestionColor.deleteMany({
        where: { suggestionId: createdSuggestionId }
      }).catch(() => null);
      await prisma.productSuggestion.delete({
        where: { id: createdSuggestionId }
      }).catch(() => null);
    }

    if (createdMessageIds.length > 0) {
      await prisma.message.deleteMany({
        where: {
          id: { in: createdMessageIds }
        }
      }).catch(() => null);
    }
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[FAIL] Smoke colaborativo interrompido: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
