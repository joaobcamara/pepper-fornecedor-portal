"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, SendHorizonal, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

type PepperIaMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  body: string;
  createdAt: string;
};

export function PepperIaPanel({
  role,
  messages,
  prompts
}: {
  role: "ADMIN" | "SUPPLIER";
  messages: PepperIaMessage[];
  prompts: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  async function sendMessage(formData: FormData) {
    setError(null);

    const response = await fetch("/api/pepperia/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: String(formData.get("message") ?? "")
      })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel falar com a Pepper IA agora.");
      return;
    }

    formRef.current?.reset();
    router.refresh();
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <aside className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[#fff1e7] p-3 text-[#c75f2d]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pepper IA</h2>
            <p className="mt-1 text-sm text-slate-500">
              {role === "ADMIN"
                ? "Assistente com visao completa do painel administrativo, estoque, fila de cadastro e operacao Pepper."
                : "Assistente do seu painel, com acesso apenas ao seu estoque, sugestoes e solicitacoes."}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[1.6rem] border border-[#f2d4c3] bg-[#fff8f3] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#cf7145]">Perguntas sugeridas</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  if (textareaRef.current) {
                    textareaRef.current.value = prompt;
                    textareaRef.current.focus();
                  }
                }}
                className="rounded-full border border-[#f2c6b0] bg-white px-3 py-2 text-xs font-semibold text-[#a64c24]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="space-y-4">
          {messages.length > 0 ? (
            messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  "max-w-[88%] rounded-[1.6rem] border px-4 py-3",
                  message.role === "USER"
                    ? "ml-auto border-[#f2b79a] bg-[#fff1e7]"
                    : "border-slate-200 bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {message.role === "USER" ? "Voce" : "Pepper IA"}
                  </p>
                  <p className="text-xs text-slate-400">{message.createdAt}</p>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{message.body}</div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Nenhuma conversa ainda. Pergunte algo para a Pepper IA e ela responde com base no seu contexto do sistema.
            </div>
          )}
        </div>

        <form ref={formRef} action={(formData) => startSending(() => void sendMessage(formData))} className="mt-6 rounded-[1.8rem] border border-slate-200 bg-slate-50/80 p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Pergunta</span>
            <textarea
              ref={textareaRef}
              name="message"
              className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder={role === "ADMIN" ? "Ex.: quais produtos precisam de reposicao urgente hoje?" : "Ex.: quais produtos meus estao criticos agora?"}
            />
          </label>

          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <button type="submit" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
            {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            {isSending ? "Consultando..." : "Perguntar para a Pepper IA"}
          </button>
        </form>
      </div>
    </section>
  );
}
