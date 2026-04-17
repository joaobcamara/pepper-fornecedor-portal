import { notFound } from "next/navigation";

import { WhatsAppShareView } from "@/components/whatsapp-share-view";
import { getWhatsAppShareLinkBySlug } from "@/lib/whatsapp-share";

export default async function WhatsAppSharePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const link = await getWhatsAppShareLinkBySlug(slug);

  if (!link) {
    notFound();
  }

  return <WhatsAppShareView link={link} />;
}
