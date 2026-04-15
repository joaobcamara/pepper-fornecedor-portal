import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";

export async function POST() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "A ficha automatica foi descontinuada neste modulo. A sugestao aprovada segue para a fila de cadastro."
    },
    { status: 410 }
  );
}
