import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

export default function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-pepper-glow px-5 py-8">
      <div className="w-full max-w-4xl rounded-[2.5rem] border border-white/70 bg-white/85 p-8 shadow-panel backdrop-blur lg:p-12">
        <LogoMark className="w-fit" />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.34em] text-[#d27a4f]">Operação Pepper</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-slate-900">
          Portal clean e seguro para fornecedores monitorarem estoque com contexto real de variação.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-500">
          A base já nasce preparada para autenticação própria, importação do Tiny via SKU, grade cor x tamanho e área
          administrativa isolada por subdomínio.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login?force=1&next=/produtos"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/50"
          >
            Entrar como fornecedor
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login?force=1&next=/admin"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Entrar no admin
          </Link>
        </div>
      </div>
    </main>
  );
}
