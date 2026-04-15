import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";

export async function POST() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "A geracao automatica foi removida deste modulo. Use a triagem manual e a fila de cadastro no Supabase."
    },
    { status: 410 }
  );
}
