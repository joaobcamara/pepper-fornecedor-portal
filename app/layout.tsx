import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Pepper | Portal do fornecedor",
  description: "Painel interno para monitoramento de estoque, grade por variacao e apoio a reposicao."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
