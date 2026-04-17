"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Bot,
  Boxes,
  DownloadCloud,
  Flame,
  LoaderCircle,
  MessageSquareText,
  PackageCheck,
  RefreshCcw,
  SendHorizonal,
  Sparkles,
  Users,
  Wallet,
  X
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { PepperIaBubblePageKey } from "@/components/pepper-ia-bubble-slot";

type PepperIaMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  body: string;
  createdAt: string;
};

type BubbleTheme = {
  key: PepperIaBubblePageKey;
  animation: "fire" | "bounce" | "shake" | "expand" | "soft";
  delayMs: number;
  icon: ComponentType<{ className?: string }>;
  buttonClassName: string;
  iconWrapClassName: string;
  teaserClassName: string;
  defaultHint: string;
};

const TEASER_VISIBLE_MS = 12000;

const SUPPLIER_THEMES: Record<PepperIaBubblePageKey, BubbleTheme> = {
  dashboard: {
    key: "dashboard",
    animation: "fire",
    delayMs: 700,
    icon: Flame,
    buttonClassName: "border-[#f2b18b] bg-[linear-gradient(135deg,#ffb26b_0%,#ec6232_60%,#d74c1d_100%)] text-white shadow-[0_18px_42px_rgba(236,98,50,0.34)]",
    iconWrapClassName: "bg-white/18 text-white",
    teaserClassName: "border-white/60 bg-white/28 text-white shadow-[0_18px_38px_rgba(130,52,18,0.18)]",
    defaultHint: "Veja o giro do periodo e descubra onde a reposicao merece prioridade."
  },
  products: {
    key: "products",
    animation: "fire",
    delayMs: 850,
    icon: Flame,
    buttonClassName: "border-[#f2b18b] bg-[linear-gradient(135deg,#ffb26b_0%,#f48a42_55%,#df5b23_100%)] text-white shadow-[0_18px_42px_rgba(236,98,50,0.32)]",
    iconWrapClassName: "bg-white/18 text-white",
    teaserClassName: "border-white/60 bg-white/30 text-white shadow-[0_18px_38px_rgba(130,52,18,0.18)]",
    defaultHint: "Use a Pepper IA para ler o estoque, o valor das variacoes e sugerir reposicao."
  },
  imports: {
    key: "imports",
    animation: "soft",
    delayMs: 950,
    icon: DownloadCloud,
    buttonClassName: "border-[#d9cdf9] bg-[linear-gradient(135deg,#faf5ff_0%,#efe5ff_52%,#e3d4ff_100%)] text-[#53358d] shadow-[0_18px_42px_rgba(125,95,201,0.18)]",
    iconWrapClassName: "bg-white/80 text-[#6d4db6]",
    teaserClassName: "border-white/72 bg-white/48 text-slate-700 shadow-[0_18px_38px_rgba(118,91,169,0.14)]",
    defaultHint: "Revise SKU pai, grade de variacoes e fornecedor antes de importar."
  },
  sync: {
    key: "sync",
    animation: "shake",
    delayMs: 3200,
    icon: RefreshCcw,
    buttonClassName: "border-[#bfd9ef] bg-[linear-gradient(135deg,#f3fbff_0%,#e2f4ff_52%,#cfe8ff_100%)] text-[#22557c] shadow-[0_18px_42px_rgba(89,147,201,0.18)]",
    iconWrapClassName: "bg-white/80 text-[#3a77a3]",
    teaserClassName: "border-white/72 bg-white/48 text-slate-700 shadow-[0_18px_38px_rgba(85,129,168,0.14)]",
    defaultHint: "Use esta tela para detectar falhas de reconciliacao e webhooks com erro."
  },
  suggestion: {
    key: "suggestion",
    animation: "bounce",
    delayMs: 650,
    icon: Sparkles,
    buttonClassName: "border-[#f4c7b2] bg-[linear-gradient(135deg,#ffd7c4_0%,#ffb58f_52%,#ef7e56_100%)] text-[#7f3416] shadow-[0_18px_42px_rgba(239,126,86,0.28)]",
    iconWrapClassName: "bg-white/75 text-[#d66b3b]",
    teaserClassName: "border-white/75 bg-white/48 text-slate-700 shadow-[0_18px_38px_rgba(148,85,53,0.14)]",
    defaultHint: "Anexe fotos claras e use a validacao antes de enviar a sugestao."
  },
  finance: {
    key: "finance",
    animation: "shake",
    delayMs: 3600,
    icon: Wallet,
    buttonClassName: "border-[#b7dfc7] bg-[linear-gradient(135deg,#dff7e6_0%,#c1efd1_45%,#85c89b_100%)] text-[#184d33] shadow-[0_18px_42px_rgba(99,169,122,0.24)]",
    iconWrapClassName: "bg-white/75 text-[#2e6a49]",
    teaserClassName: "border-white/70 bg-white/46 text-slate-700 shadow-[0_18px_38px_rgba(80,129,95,0.15)]",
    defaultHint: "Acompanhe valor estimado do estoque, margem e produtos de maior impacto financeiro."
  },
  orders: {
    key: "orders",
    animation: "expand",
    delayMs: 950,
    icon: PackageCheck,
    buttonClassName: "border-[#c8d8ff] bg-[linear-gradient(135deg,#edf3ff_0%,#dde8ff_45%,#c9d9ff_100%)] text-[#27437c] shadow-[0_18px_42px_rgba(103,130,201,0.22)]",
    iconWrapClassName: "bg-white/80 text-[#395ca1]",
    teaserClassName: "border-white/72 bg-white/48 text-slate-700 shadow-[0_18px_38px_rgba(82,105,155,0.15)]",
    defaultHint: "Veja pedidos recebidos, romaneios e atualize o status do envio com rapidez."
  },
  messages: {
    key: "messages",
    animation: "soft",
    delayMs: 900,
    icon: MessageSquareText,
    buttonClassName: "border-[#c8d5f2] bg-[linear-gradient(135deg,#f3f7ff_0%,#e7eefc_52%,#d7e3fb_100%)] text-[#314772] shadow-[0_18px_42px_rgba(95,122,176,0.18)]",
    iconWrapClassName: "bg-white/80 text-[#486293]",
    teaserClassName: "border-white/72 bg-white/46 text-slate-700 shadow-[0_18px_38px_rgba(93,116,157,0.14)]",
    defaultHint: "Use este canal para responder rapido a alinhamentos da equipe Pepper."
  },
  suppliers: {
    key: "suppliers",
    animation: "soft",
    delayMs: 900,
    icon: Building2,
    buttonClassName: "border-[#f3d9c7] bg-[linear-gradient(135deg,#fff7f2_0%,#ffede0_52%,#f9dbc8_100%)] text-[#8f4f29] shadow-[0_18px_42px_rgba(171,108,67,0.16)]",
    iconWrapClassName: "bg-white/80 text-[#b46b3f]",
    teaserClassName: "border-white/72 bg-white/48 text-slate-700 shadow-[0_18px_38px_rgba(145,95,66,0.14)]",
    defaultHint: "Veja fornecedores ativos, permissoes de valores e lacunas de cadastro."
  },
  users: {
    key: "users",
    animation: "soft",
    delayMs: 900,
    icon: Users,
    buttonClassName: "border-[#d5e6d8] bg-[linear-gradient(135deg,#f6fff7_0%,#e9f7eb_52%,#d7eddc_100%)] text-[#31593c] shadow-[0_18px_42px_rgba(98,144,109,0.16)]",
    iconWrapClassName: "bg-white/80 text-[#4d7a57]",
    teaserClassName: "border-white/72 bg-white/48 text-slate-700 shadow-[0_18px_38px_rgba(93,129,101,0.14)]",
    defaultHint: "Revise acessos, perfis e vinculos de escopo antes de subir o sistema."
  },
  generic: {
    key: "generic",
    animation: "soft",
    delayMs: 900,
    icon: Bot,
    buttonClassName: "border-[#f0b08f] bg-[linear-gradient(135deg,#ffb36f_0%,#ec6232_60%,#d95628_100%)] text-white shadow-[0_18px_42px_rgba(236,98,50,0.32)]",
    iconWrapClassName: "bg-white/18 text-white",
    teaserClassName: "border-white/60 bg-white/30 text-white shadow-[0_18px_38px_rgba(130,52,18,0.18)]",
    defaultHint: "A Pepper IA esta pronta para ajudar com o contexto da pagina."
  }
};

function resolveSupplierPageKey(pathname: string | null): PepperIaBubblePageKey {
  if (!pathname) return "generic";
  if (pathname === "/admin" || pathname === "/dashboard" || pathname.includes("/dashboard")) return "dashboard";
  if (pathname.includes("/admin/produtos") || pathname.includes("/produtos")) return "products";
  if (pathname.includes("/admin/importacao-tiny")) return "products";
  if (pathname.includes("/admin/sincronizacoes")) return "sync";
  if (pathname.includes("/admin/sugestoes-produto") || pathname.includes("/sugestao-produto")) return "suggestion";
  if (pathname.includes("/financeiro")) return "finance";
  if (pathname.includes("/pedidos-recebidos") || pathname.includes("/pedidos-fornecedor") || pathname.includes("/solicitacoes-reposicao")) return "orders";
  if (pathname.includes("/mensagens") || pathname.includes("/conversas")) return "messages";
  if (pathname.includes("/admin/fornecedores")) return "suppliers";
  if (pathname.includes("/admin/usuarios")) return "users";
  return "generic";
}

export function PepperIaBubble({
  role,
  messages,
  prompts,
  pageKey,
  pageHint,
  alertCount = 0
}: {
  role: "ADMIN" | "SUPPLIER";
  messages: PepperIaMessage[];
  prompts: string[];
  pageKey?: PepperIaBubblePageKey;
  pageHint?: string | null;
  alertCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const [transientAnimation, setTransientAnimation] = useState<"bounce" | "shake" | "expand" | null>(null);

  const resolvedPageKey = pageKey ?? resolveSupplierPageKey(pathname);
  const theme = SUPPLIER_THEMES[resolvedPageKey] ?? SUPPLIER_THEMES.generic;
  const Icon = role === "SUPPLIER" ? theme.icon : Bot;

  useEffect(() => {
    if (isOpen) {
      setShowTeaser(false);
      setTransientAnimation(null);
      return;
    }

    const showTimeout = window.setTimeout(() => {
      setShowTeaser(true);
      if (theme.animation === "bounce" || theme.animation === "shake" || theme.animation === "expand") {
        setTransientAnimation(theme.animation);
      }
    }, theme.delayMs);

    const hideTimeout = window.setTimeout(() => {
      setShowTeaser(false);
    }, theme.delayMs + TEASER_VISIBLE_MS);

    const animationTimeout = window.setTimeout(() => {
      setTransientAnimation(null);
    }, theme.delayMs + 1100);

    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
      window.clearTimeout(animationTimeout);
    };
  }, [isOpen, pathname, pageHint, theme.animation, theme.delayMs]);

  const buttonAnimationClassName = useMemo(() => {
    if (role !== "SUPPLIER") return "";
    if (transientAnimation === "bounce") return "pepper-bubble-bounce";
    if (transientAnimation === "shake") return "pepper-bubble-shake";
    if (transientAnimation === "expand") return "pepper-bubble-expand";
    return "";
  }, [role, transientAnimation]);

  async function sendMessage(formData: FormData) {
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/pepperia/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: String(formData.get("message") ?? ""),
          pageKey: resolvedPageKey,
          pageHint: pageHint ?? null
        })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel falar com a Pepper IA agora.");
        return;
      }

      formRef.current?.reset();
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel falar com a Pepper IA agora.");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(new FormData(event.currentTarget));
  }

  return (
      <>
      <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex flex-col items-end gap-3 lg:bottom-5 lg:right-5 lg:top-auto">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={cn(
            "relative inline-flex h-11 w-11 items-center justify-center rounded-full border p-0 text-xs font-semibold transition duration-300 hover:scale-[1.02] lg:h-auto lg:w-auto lg:gap-3 lg:px-4 lg:py-3 lg:text-sm",
            role === "ADMIN"
              ? "border-[#d7dff2] bg-[linear-gradient(135deg,#f7faff_0%,#edf3ff_58%,#dde9ff_100%)] text-[#2f4678] shadow-[0_18px_42px_rgba(91,113,162,0.18)]"
              : theme.buttonClassName,
            buttonAnimationClassName
          )}
          aria-label="Abrir Pepper IA"
        >
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md lg:h-10 lg:w-10",
              theme.iconWrapClassName,
              role === "SUPPLIER" && theme.animation === "fire" && "pepper-fire-wrap"
            )}
          >
            {isOpen ? (
              <X className="h-4 w-4 lg:h-5 lg:w-5" />
            ) : (
              <Icon className={cn("h-4 w-4 lg:h-5 lg:w-5", role === "SUPPLIER" && theme.animation === "fire" && "pepper-fire-icon")} />
            )}
          </span>
          <span className="hidden font-semibold lg:inline">Pepper IA</span>
          {alertCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#ef6a3a] px-1 text-[10px] font-bold leading-none text-white shadow-[0_10px_24px_rgba(239,106,58,0.28)] lg:min-h-6 lg:min-w-6 lg:text-[11px]">
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          ) : null}
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[2px]" onClick={() => setIsOpen(false)}>
          <div
            className="absolute inset-x-3 bottom-3 top-[calc(env(safe-area-inset-top)+4rem)] flex w-auto flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white/95 shadow-[0_25px_80px_rgba(15,23,42,0.22)] md:inset-x-auto md:bottom-24 md:right-5 md:top-auto md:h-[min(42rem,calc(100vh-8rem))] md:w-[min(26rem,calc(100vw-2.5rem))]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className={cn("rounded-2xl p-3", role === "SUPPLIER" ? theme.iconWrapClassName : "bg-[#fff1e7] text-[#c75f2d]")}>
                  <Icon className={cn("h-5 w-5", role === "SUPPLIER" && theme.animation === "fire" && "pepper-fire-icon")} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900">Pepper IA</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {role === "ADMIN"
                      ? "Assistente com contexto completo do painel admin."
                      : "Assistente do seu painel, com leitura contextual desta pagina e sem expor outros fornecedores."}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
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
                    className="rounded-full border border-[#f2c6b0] bg-white px-3 py-2 text-[11px] font-semibold text-[#a64c24]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/80 px-4 py-4">
              {messages.length > 0 ? (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={cn(
                      "max-w-[88%] rounded-[1.4rem] border px-4 py-3",
                      message.role === "USER"
                        ? "ml-auto border-[#f2b79a] bg-[#fff1e7]"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-900">
                        {message.role === "USER" ? "Voce" : "Pepper IA"}
                      </p>
                      <p className="text-[11px] text-slate-400">{message.createdAt}</p>
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{message.body}</div>
                  </article>
                ))
              ) : (
                <div className="flex h-full items-center justify-center rounded-[1.6rem] border border-dashed border-slate-200 bg-white px-4 text-center text-sm text-slate-500">
                  <div>
                    <MessageSquareText className="mx-auto mb-3 h-5 w-5 text-slate-400" />
                    Nenhuma conversa ainda. Fale com a Pepper IA por aqui.
                  </div>
                </div>
              )}
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="border-t border-slate-200 bg-white px-4 py-4">
              <textarea
                ref={textareaRef}
                name="message"
                className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                placeholder={
                  role === "ADMIN"
                    ? "Ex.: quais produtos precisam de reposicao urgente hoje?"
                    : "Ex.: quais produtos meus estao criticos agora?"
                }
              />

              {error ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              ) : null}

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">As respostas usam apenas o contexto permitido do seu perfil.</p>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                >
                  {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                  {isSending ? "Consultando..." : "Enviar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .pepper-fire-wrap {
          animation: pepperGlow 2.8s ease-in-out infinite;
        }

        .pepper-fire-icon {
          animation: pepperFlame 2.2s ease-in-out infinite;
          transform-origin: center bottom;
        }

        .pepper-bubble-bounce {
          animation: pepperBounce 0.9s ease-out 1;
        }

        .pepper-bubble-shake {
          animation: pepperShake 0.72s ease-in-out 1;
        }

        .pepper-bubble-expand {
          animation: pepperExpand 1s ease-out 1;
        }

        @keyframes pepperFlame {
          0%,
          100% {
            transform: translateY(0) rotate(-4deg) scale(1);
          }
          25% {
            transform: translateY(-1px) rotate(3deg) scale(1.06);
          }
          50% {
            transform: translateY(-2px) rotate(-2deg) scale(0.98);
          }
          75% {
            transform: translateY(-1px) rotate(4deg) scale(1.04);
          }
        }

        @keyframes pepperGlow {
          0%,
          100% {
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 0 0 rgba(255, 153, 80, 0.2);
          }
          50% {
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 0 22px rgba(255, 171, 92, 0.24);
          }
        }

        @keyframes pepperBounce {
          0% {
            transform: translateY(0);
          }
          35% {
            transform: translateY(-8px);
          }
          65% {
            transform: translateY(1px);
          }
          100% {
            transform: translateY(0);
          }
        }

        @keyframes pepperShake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-4px) rotate(-1deg);
          }
          40% {
            transform: translateX(4px) rotate(1deg);
          }
          60% {
            transform: translateX(-3px);
          }
          80% {
            transform: translateX(3px);
          }
        }

        @keyframes pepperExpand {
          0% {
            transform: scaleX(1);
          }
          35% {
            transform: scaleX(1.08);
          }
          60% {
            transform: scaleX(1.03);
          }
          100% {
            transform: scaleX(1);
          }
        }
      `}</style>
    </>
  );
}
