import { PrismaClient, ProductKind, UserRole } from "@prisma/client";
import { createHash } from "node:crypto";
import { rebuildCatalogLayer } from "./catalog-sync";

const prisma = new PrismaClient();

function hashPassword(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.productSuggestionImage.deleteMany();
  await prisma.productSuggestionSize.deleteMany();
  await prisma.productSuggestionColor.deleteMany();
  await prisma.productSuggestion.deleteMany();
  await prisma.syncRun.deleteMany();
  await prisma.inventorySnapshot.deleteMany();
  await prisma.productSupplier.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.supplier.deleteMany();

  const supplier = await prisma.supplier.create({
    data: {
      name: "Luna Têxtil",
      slug: "luna-textil"
    }
  });

  await prisma.user.createMany({
    data: [
      {
        username: "admin",
        passwordHash: hashPassword("pepper123"),
        role: UserRole.ADMIN
      },
      {
        username: "luna",
        passwordHash: hashPassword("pepper123"),
        role: UserRole.SUPPLIER,
        supplierId: supplier.id
      }
    ]
  });

  const [adminUser, supplierUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { username: "admin" } }),
    prisma.user.findUniqueOrThrow({ where: { username: "luna" } })
  ]);

  const conversation = await prisma.conversation.create({
    data: {
      supplierId: supplier.id,
      lastMessageAt: new Date()
    }
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        senderUserId: adminUser.id,
        senderRole: "ADMIN",
        body: "Bom dia! Assim que precisar, pode usar este canal para falar com a Pepper."
      },
      {
        conversationId: conversation.id,
        senderUserId: supplierUser.id,
        senderRole: "SUPPLIER",
        body: "Perfeito, vou usar para dúvidas de estoque e pedido."
      }
    ]
  });

  await prisma.productSuggestion.create({
    data: {
      supplierId: supplier.id,
      productName: "Body canelado alça média",
      price: 59.9,
      material: "Canelado premium",
      modelDescription: "Body com modelagem ajustada, alça média e ótimo giro para cores neutras.",
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
        create: [{ label: "P" }, { label: "M" }, { label: "G" }]
      },
      colors: {
        create: [{ label: "Preto" }, { label: "Bege" }, { label: "Vinho" }]
      }
    }
  });

  const parent = await prisma.product.create({
    data: {
      internalName: "Conjunto Fitness Aura",
      sku: "01-2504",
      baseCode: "2504",
      quantityCode: "01",
      kind: ProductKind.PARENT,
      criticalStockThreshold: 2,
      lowStockThreshold: 8,
      tinyProductId: "853906359",
      tinyCode: "2504",
      imageUrl: "/brand/pepper-logo.png",
      fallbackInventory: 18
    }
  });

  const variants = [
    { sku: "01-2504-21-01", sizeCode: "21", colorCode: "01", qty: 3, name: "Conjunto Fitness Aura P Preto" },
    { sku: "01-2504-22-01", sizeCode: "22", colorCode: "01", qty: 7, name: "Conjunto Fitness Aura M Preto" },
    { sku: "01-2504-23-01", sizeCode: "23", colorCode: "01", qty: 0, name: "Conjunto Fitness Aura G Preto" },
    { sku: "01-2504-21-03", sizeCode: "21", colorCode: "03", qty: 2, name: "Conjunto Fitness Aura P Vermelho" },
    { sku: "01-2504-22-03", sizeCode: "22", colorCode: "03", qty: 6, name: "Conjunto Fitness Aura M Vermelho" }
  ];

  for (const variant of variants) {
    const product = await prisma.product.create({
      data: {
        internalName: variant.name,
        sku: variant.sku,
        skuParent: parent.sku,
        baseCode: "2504",
        quantityCode: "01",
        sizeCode: variant.sizeCode,
        colorCode: variant.colorCode,
        kind: ProductKind.VARIANT,
        criticalStockThreshold: variant.sku === "01-2504-22-01" ? 5 : null,
        lowStockThreshold: variant.sku === "01-2504-22-01" ? 14 : null,
        tinyProductId: `${parent.tinyProductId}-${variant.sku}`,
        tinyCode: variant.sku,
        imageUrl: "/brand/pepper-logo.png",
        parentId: parent.id,
        fallbackInventory: variant.qty,
        lastSyncedAt: new Date()
      }
    });

    await prisma.productSupplier.create({
      data: {
        productId: product.id,
        supplierId: supplier.id
      }
    });

    await prisma.inventorySnapshot.create({
      data: {
        productId: product.id,
        quantity: variant.qty,
        stockBand: variant.qty <= 2 ? "critical" : variant.qty <= 8 ? "low" : "ok"
      }
    });
  }

  await rebuildCatalogLayer(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
