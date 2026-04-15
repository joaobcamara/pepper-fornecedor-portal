import { NextResponse } from "next/server";
import { getRouteSession } from "@/lib/route-session";
import { saveUploadedFile } from "@/lib/local-files";

export async function POST(request: Request) {
  const session = await getRouteSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const supplierSlug = String(formData.get("supplierSlug") ?? "supplier").trim() || "supplier";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecione uma imagem para enviar." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Envie apenas arquivos de imagem." }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "A imagem deve ter no maximo 5MB." }, { status: 400 });
  }

  try {
    const uploaded = await saveUploadedFile({
      file,
      folder: "uploads/supplier-logos",
      prefix: supplierSlug
    });

    return NextResponse.json({
      ok: true,
      fileName: uploaded.fileName,
      fileUrl: uploaded.fileUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel enviar a logo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
