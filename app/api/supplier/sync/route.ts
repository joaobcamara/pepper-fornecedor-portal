import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { syncSupplierInventory } from "@/lib/supplier-sync";

export async function POST() {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const result = await syncSupplierInventory({
    supplierId: session.supplierId,
    requestedByUserId: session.userId,
    triggerType: "manual",
    force: true
  });

  return NextResponse.json(result);
}
