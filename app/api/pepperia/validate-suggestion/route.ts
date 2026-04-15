import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { parseTagValues } from "@/lib/suggestion-data-v2";
import { validateSupplierSuggestionWithIa } from "@/lib/pepperia-openai";

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const formData = await request.formData();
  const productName = String(formData.get("productName") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const material = String(formData.get("material") ?? "").trim();
  const modelDescription = String(formData.get("modelDescription") ?? "").trim();
  const sizes = parseTagValues(String(formData.get("sizes") ?? ""));
  const colors = parseTagValues(String(formData.get("colors") ?? ""));
  const frontImage = formData.get("frontImage");
  const backImage = formData.get("backImage");
  const frontFile = frontImage instanceof File && frontImage.size > 0 ? frontImage : null;
  const backFile = backImage instanceof File && backImage.size > 0 ? backImage : null;

  if (!frontFile || !backFile) {
    return NextResponse.json(
      { error: "Anexe as fotos de frente e costas antes de validar a sugestao com a Pepper IA." },
      { status: 400 }
    );
  }

  const result = await validateSupplierSuggestionWithIa({
    productName,
    price,
    material,
    modelDescription,
    sizes,
    colors,
    frontImage: frontFile,
    backImage: backFile
  });

  await prisma.suggestionValidationDraft.create({
    data: {
      userId: session.userId,
      supplierId: session.supplierId,
      payloadJson: JSON.stringify({ productName, price, material, modelDescription, sizes, colors }),
      resultJson: JSON.stringify(result)
    }
  });

  return NextResponse.json({ ok: true, result });
}
