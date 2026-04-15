import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";

export async function POST() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "O envio direto ao Tiny foi removido deste modulo. Use a aprovacao para fila de cadastro no Supabase."
    },
    { status: 410 }
  );
}
