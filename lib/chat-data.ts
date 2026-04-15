import { MessageSenderRole } from "@prisma/client";
import { getDemoUnreadCount } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

export async function ensureConversationForSupplier(supplierId: string) {
  return prisma.conversation.upsert({
    where: {
      supplierId
    },
    update: {},
    create: {
      supplierId
    }
  });
}

export async function getSupplierUnreadCount(userId: string, supplierId?: string | null) {
  if (!supplierId) {
    return 0;
  }

  try {
    const conversation = await ensureConversationForSupplier(supplierId);
    return prisma.message.count({
      where: {
        conversationId: conversation.id,
        senderRole: MessageSenderRole.ADMIN,
        readAt: null,
        senderUserId: {
          not: userId
        }
      }
    });
  } catch {
    return getDemoUnreadCount();
  }
}

export async function getSupplierConversationView(userId: string, supplierId: string) {
  try {
    const conversation = await prisma.conversation.upsert({
      where: {
        supplierId
      },
      update: {},
      create: {
        supplierId
      },
      include: {
        supplier: true,
        messages: {
          orderBy: {
            createdAt: "asc"
          },
          include: {
        attachments: true,
            senderUser: true
          }
        }
      }
    });

    const unreadMessageIds = conversation.messages
      .filter((message) => message.senderRole === MessageSenderRole.ADMIN && !message.readAt)
      .map((message) => message.id);

    if (unreadMessageIds.length > 0) {
      await prisma.message.updateMany({
        where: {
          id: {
            in: unreadMessageIds
          }
        },
        data: {
          readAt: new Date()
        }
      });
    }

    return {
      conversationId: conversation.id,
      supplierName: conversation.supplier.name,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        body: message.body,
        senderRole: message.senderRole,
        senderName: message.senderUser.username,
        createdAt: message.createdAt.toLocaleString("pt-BR"),
        readAt: message.readAt ? message.readAt.toLocaleString("pt-BR") : null,
        attachments: message.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl
        })),
        reference:
          message.referenceTitle && message.referenceType && message.referenceId
            ? {
                type: message.referenceType,
                id: message.referenceId,
                title: message.referenceTitle,
                subtitle: message.referenceSubtitle,
                href: message.referenceHref,
                badge: message.referenceBadge,
                metaJson: message.referenceMetaJson
              }
            : null
      }))
    };
  } catch {
    return {
      conversationId: `offline-${supplierId}`,
      supplierName: "Canal Pepper",
      messages: []
    };
  }
}

export async function getAdminConversationList() {
  try {
    const conversations = await prisma.conversation.findMany({
      include: {
        supplier: true,
        messages: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        },
        _count: {
          select: {
            messages: {
              where: {
                senderRole: MessageSenderRole.SUPPLIER,
                readAt: null
              }
            }
          }
        }
      },
      orderBy: [
        {
          lastMessageAt: "desc"
        },
        {
          updatedAt: "desc"
        }
      ]
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      supplierId: conversation.supplierId,
      supplierName: conversation.supplier.name,
      lastMessagePreview:
        conversation.messages[0]?.referenceTitle && conversation.messages[0]?.body
          ? `${conversation.messages[0].body} • ${conversation.messages[0].referenceTitle}`
          : conversation.messages[0]?.referenceTitle ?? conversation.messages[0]?.body ?? "Sem mensagens ainda.",
      lastMessageAt: conversation.messages[0]?.createdAt.toLocaleString("pt-BR") ?? "Sem atividade",
      unreadCount: conversation._count.messages
    }));
  } catch {
    return [];
  }
}

export async function getAdminConversationView(conversationId: string) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId
      },
      include: {
        supplier: true,
        messages: {
          orderBy: {
            createdAt: "asc"
          },
          include: {
            attachments: true,
            senderUser: true
          }
        }
      }
    });

    if (!conversation) {
      return null;
    }

    const unreadSupplierMessageIds = conversation.messages
      .filter((message) => message.senderRole === MessageSenderRole.SUPPLIER && !message.readAt)
      .map((message) => message.id);

    if (unreadSupplierMessageIds.length > 0) {
      await prisma.message.updateMany({
        where: {
          id: {
            in: unreadSupplierMessageIds
          }
        },
        data: {
          readAt: new Date()
        }
      });
    }

    return {
      id: conversation.id,
      supplierName: conversation.supplier.name,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        body: message.body,
        senderRole: message.senderRole,
        senderName: message.senderUser.username,
        createdAt: message.createdAt.toLocaleString("pt-BR"),
        attachments: message.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl
        })),
        reference:
          message.referenceTitle && message.referenceType && message.referenceId
            ? {
                type: message.referenceType,
                id: message.referenceId,
                title: message.referenceTitle,
                subtitle: message.referenceSubtitle,
                href: message.referenceHref,
                badge: message.referenceBadge,
                metaJson: message.referenceMetaJson
              }
            : null
      }))
    };
  } catch {
    return null;
  }
}
