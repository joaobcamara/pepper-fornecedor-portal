import { NextResponse } from "next/server";
import { ProductSuggestionStatus, SuggestionImageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { saveUploadedFile } from "@/lib/local-files";
import { parseTagValues } from "@/lib/suggestion-data-v2";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
      return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const suggestionId = String(formData.get("suggestionId") ?? "").trim();
    const productName = String(formData.get("productName") ?? "").trim();
    const price = Number(formData.get("price") ?? 0);
    const material = String(formData.get("material") ?? "").trim();
    const modelDescription = String(formData.get("modelDescription") ?? "").trim();
    const sizes = parseTagValues(String(formData.get("sizes") ?? ""));
    const colors = parseTagValues(String(formData.get("colors") ?? ""));
    const frontImage = formData.get("frontImage");
    const backImage = formData.get("backImage");

    if (!productName || !material || !modelDescription || !Number.isFinite(price) || price <= 0 || sizes.length === 0 || colors.length === 0) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatorios da sugestao." }, { status: 400 });
    }

    const isEditing = Boolean(suggestionId);

    if (!isEditing && (!(frontImage instanceof File) || frontImage.size === 0 || !(backImage instanceof File) || backImage.size === 0)) {
      return NextResponse.json({ error: "As fotos de frente e costas sao obrigatorias." }, { status: 400 });
    }

    if (isEditing) {
      const existing = await prisma.productSuggestion.findFirst({
        where: {
          id: suggestionId,
          supplierId: session.supplierId
        },
        include: {
          images: true
        }
      });

      if (!existing) {
        return NextResponse.json({ error: "Sugestao nao encontrada." }, { status: 404 });
      }

      if (existing.status !== ProductSuggestionStatus.NEEDS_REVISION) {
        return NextResponse.json({ error: "Somente sugestoes devolvidas para correcao podem ser reenviadas." }, { status: 400 });
      }

      const newFront = frontImage instanceof File && frontImage.size > 0
        ? await saveUploadedFile({ file: frontImage, folder: "uploads/suggestions", prefix: "front" })
        : null;
      const newBack = backImage instanceof File && backImage.size > 0
        ? await saveUploadedFile({ file: backImage, folder: "uploads/suggestions", prefix: "back" })
        : null;

      await prisma.productSuggestion.update({
        where: {
          id: existing.id
        },
        data: {
          productName,
          price,
          material,
          modelDescription,
          status: ProductSuggestionStatus.REVIEWING,
          supplierVisibleNote: null,
          internalReviewNote: null,
          revisionRequestedAt: null,
          notes: null,
          approvedAt: null,
          approvedByUserId: null,
          rejectedAt: null,
          importedAt: null,
          importedBy: null,
          revisionCount: {
            increment: 1
          },
          generatedCatalogJson: null,
          adminDraftName: null,
          adminDraftPrice: null,
          adminDraftMaterial: null,
          adminDraftModel: null,
          sizes: {
            deleteMany: {},
            create: sizes.map((label) => ({ label }))
          },
          colors: {
            deleteMany: {},
            create: colors.map((label) => ({ label }))
          },
          images: {
            updateMany: [
              newFront
                ? {
                    where: { type: SuggestionImageType.FRONT },
                    data: newFront
                  }
                : undefined,
              newBack
                ? {
                    where: { type: SuggestionImageType.BACK },
                    data: newBack
                  }
                : undefined
            ].filter(Boolean) as never
          },
          statusHistory: {
            create: {
              fromStatus: existing.status,
              toStatus: ProductSuggestionStatus.REVIEWING,
              note: "Fornecedor reenviou a sugestao com correcoes.",
              visibleToSupplier: true
            }
          }
        }
      });

      return NextResponse.json({ ok: true, suggestionId: existing.id, mode: "resubmitted" });
    }

    const [frontFile, backFile] = await Promise.all([
      saveUploadedFile({ file: frontImage as File, folder: "uploads/suggestions", prefix: "front" }),
      saveUploadedFile({ file: backImage as File, folder: "uploads/suggestions", prefix: "back" })
    ]);

    const suggestion = await prisma.productSuggestion.create({
      data: {
        supplierId: session.supplierId,
        productName,
        price,
        material,
        modelDescription,
        status: ProductSuggestionStatus.NEW,
        images: {
          create: [
            {
              type: "FRONT",
              ...frontFile
            },
            {
              type: "BACK",
              ...backFile
            }
          ]
        },
        sizes: {
          create: sizes.map((label) => ({
            label
          }))
        },
        colors: {
          create: colors.map((label) => ({
            label
          }))
        },
        statusHistory: {
          create: {
            toStatus: ProductSuggestionStatus.NEW,
            note: "Sugestao enviada pelo fornecedor.",
            visibleToSupplier: true
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      suggestionId: suggestion.id,
      mode: "created"
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel salvar a sugestao agora. Tente novamente em instantes." },
      { status: 503 }
    );
  }
}
