import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export default async function AdminImportacaoPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/produtos");
  }

  redirect("/admin/produtos");
}
