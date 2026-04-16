"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LoaderCircle, Paperclip, Plus, SendHorizonal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConversationReference, ConversationReferenceCard } from "@/components/conversation-reference-card";
import { ConversationShortcutGroup, getSlashSearchResult } from "@/lib/chat-shortcuts-shared";

type ConversationListItem = {
  id: string;
  supplierId: string;
  supplierName: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
};

type ConversationDetail = {
  id: string;
  supplierName: string;
  messages: Array<{
    id: string;
    body: string;
    senderRole: "ADMIN" | "SUPPLIER";
    senderName: string;
    createdAt: string;
    attachments: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
    }>;
    reference: ConversationReference | null;
  }>;
};

export function AdminConversationsPanel({
  conversations,
  initialConversation,
  shortcutGroups
}: {
  conversations: ConversationListItem[];
  initialConversation: ConversationDetail | null;
  shortcutGroups: ConversationShortcutGroup[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversation?.id ?? conversations[0]?.id ?? null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortcutPanelOpen, setShortcutPanelOpen] = useState(false);
  const [selectedShortcut, setSelectedShortcut] = useState<ConversationReference | null>(null);
  const [selectedShortcutMeta, setSelectedShortcutMeta] = useState<string | null>(null);
  const [bodyInput, setBodyInput] = useState("");
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(shortcutGroups[0]?.key ?? null);
  const selectedConversation = initialConversation;
  const activeGroup = useMemo(
    () => shortcutGroups.find((group) => group.key === activeGroupKey) ?? shortcutGroups[0] ?? null,
    [activeGroupKey, shortcutGroups]
  );
  const slashResult = useMemo(() => getSlashSearchResult(shortcutGroups, bodyInput), [bodyInput, shortcutGroups]);

  async function sendMessage(formData: FormData) {
    if (!selectedId) {
      return;
    }

    setError(null);
    setIsSending(true);
    formData.set("conversationId", selectedId);

    if (selectedShortcut) {
      formData.set("referenceType", selectedShortcut.type);
      formData.set("referenceId", selectedShortcut.id);
      formData.set("referenceTitle", selectedShortcut.title);
      formData.set("referenceSubtitle", selectedShortcut.subtitle ?? "");
      formData.set("referenceHref", selectedShortcut.href ?? "");
      formData.set("referenceBadge", selectedShortcut.badge ?? "");
      formData.set("referenceMetaJson", selectedShortcut.metaJson ?? selectedShortcutMeta ?? "");
    }

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel enviar a mensagem.");
        return;
      }

      formRef.current?.reset();
      setSelectedShortcut(null);
      setSelectedShortcutMeta(null);
      setShortcutPanelOpen(false);
      setBodyInput("");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel enviar a mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(new FormData(event.currentTarget));
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <aside className="rounded-[2rem] border border-white/70 bg-white/88 p-4 shadow-panel backdrop-blur">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Inbox Pepper</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Conversas ativas</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
            {conversations.length}
          </span>
        </div>
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => {
                setSelectedId(conversation.id);
                router.push(`/admin/conversas?conversation=${conversation.id}`);
              }}
              className={cn(
                "w-full rounded-[1.6rem] border p-4 text-left transition",
                selectedId === conversation.id
                  ? "border-[#f2b79a] bg-[#fff1e7]"
                  : "border-slate-100 bg-slate-50/70 hover:border-slate-200"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">{conversation.supplierName}</h2>
                {conversation.unreadCount > 0 ? (
                  <span className="rounded-full bg-[#ec6232] px-2 py-0.5 text-xs font-semibold text-white">
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">{conversation.lastMessagePreview}</p>
              <p className="mt-2 text-xs text-slate-400">{conversation.lastMessageAt}</p>
            </button>
          ))}
        </div>
      </aside>

      <div className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        {selectedConversation ? (
          <>
            <div className="border-b border-slate-100 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d27a4f]">Bate-papo Pepper</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedConversation.supplierName}</h2>
              <p className="mt-2 text-sm text-slate-500">
                Use o composer abaixo para responder e compartilhar contexto de produtos, pedidos, sugestoes ou cadastros.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {selectedConversation.messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "max-w-[88%] rounded-[1.6rem] border px-4 py-3",
                    message.senderRole === "ADMIN"
                      ? "ml-auto border-[#f2b79a] bg-[#fff1e7]"
                      : "border-slate-200 bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{message.senderName}</p>
                    <p className="text-xs text-slate-400">{message.createdAt}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{message.body}</p>
                  {message.reference ? (
                    <ConversationReferenceCard reference={message.reference} className="mt-3 min-w-[260px]" />
                  ) : null}
                  {message.attachments.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {attachment.fileName}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="mt-6 rounded-[1.8rem] border border-slate-200 bg-slate-50/80 p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShortcutPanelOpen((current) => !current)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
                    shortcutPanelOpen
                      ? "border-[#f2b79a] bg-[#fff1e7] text-[#a94b25]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Atalho
                </button>

                <p className="text-xs text-slate-500">
                  Compartilhe cards de produtos, sugestoes, pedidos, fornecedores e usuarios diretamente na conversa.
                </p>
              </div>

              {shortcutPanelOpen && activeGroup ? (
                <div className="mt-4 rounded-[1.6rem] border border-slate-200 bg-white/90 p-4">
                  <div className="flex flex-wrap gap-2">
                    {shortcutGroups.map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => setActiveGroupKey(group.key)}
                        className={cn(
                          "rounded-full px-3 py-2 text-xs font-semibold transition",
                          group.key === activeGroup.key
                            ? "bg-[#fff1e7] text-[#a94b25]"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{activeGroup.label}</h3>
                      <p className="mt-1 text-xs text-slate-500">{activeGroup.description}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                      {activeGroup.items.length} itens
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {activeGroup.items.map((item) => (
                      <ConversationReferenceCard
                        key={item.id}
                        reference={{
                          type: item.referenceType,
                          id: item.referenceId,
                          title: item.title,
                          subtitle: item.subtitle,
                          href: item.href,
                          badge: item.badge,
                          metaJson: item.metaJson
                        }}
                        selected={selectedShortcut?.type === item.referenceType && selectedShortcut.id === item.referenceId}
                        onClick={() => {
                          setSelectedShortcut({
                            type: item.referenceType,
                            id: item.referenceId,
                            title: item.title,
                            subtitle: item.subtitle,
                            href: item.href,
                            badge: item.badge,
                            metaJson: item.metaJson
                          });
                          setSelectedShortcutMeta(item.metaJson ?? null);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedShortcut ? (
                <div className="mt-4 rounded-[1.6rem] border border-[#f2d4c3] bg-[#fff8f3] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cf7145]">Contexto selecionado</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Este card sera enviado junto com a sua mensagem e fica salvo no historico.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedShortcut(null);
                        setSelectedShortcutMeta(null);
                      }}
                      className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                      <ConversationReferenceCard reference={selectedShortcut} />
                </div>
              ) : null}

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Responder</span>
                <textarea
                  name="body"
                  value={bodyInput}
                  onChange={(event) => setBodyInput(event.target.value)}
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="Escreva aqui sua mensagem para o fornecedor. Use /produto, /fornecedor ou /pedido."
                />
              </label>

              {slashResult ? (
                <div className="mt-3 rounded-[1.6rem] border border-slate-200 bg-white/95 p-4">
                  {slashResult.mode === "commands" ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#cf7145]">Atalhos disponiveis</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {slashResult.options.length > 0 ? (
                          slashResult.options.map((option) => (
                            <button
                              key={option.command}
                              type="button"
                              onClick={() => setBodyInput(`/${option.command}`)}
                              className="rounded-[1.3rem] border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-[#f2b79a] hover:bg-[#fff6f0]"
                            >
                              <p className="text-sm font-semibold text-slate-900">/{option.command}</p>
                              <p className="mt-1 text-xs text-slate-500">{option.description}</p>
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Nenhum atalho combina com esse comando ainda.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#cf7145]">
                            Resultados para /{slashResult.commandText}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{slashResult.option.description}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                          {slashResult.items.length} itens
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {slashResult.items.length > 0 ? (
                          slashResult.items.map((item) => (
                            <ConversationReferenceCard
                              key={`${slashResult.option.command}-${item.id}`}
                              reference={{
                                type: item.referenceType,
                                id: item.referenceId,
                                title: item.title,
                                subtitle: item.subtitle,
                                href: item.href,
                                badge: item.badge,
                                metaJson: item.metaJson
                              }}
                              onClick={() => {
                                setSelectedShortcut({
                                  type: item.referenceType,
                                  id: item.referenceId,
                                  title: item.title,
                                  subtitle: item.subtitle,
                                  href: item.href,
                                  badge: item.badge,
                                  metaJson: item.metaJson
                                });
                                setSelectedShortcutMeta(item.metaJson ?? null);
                                setBodyInput("");
                              }}
                            />
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">
                            Nenhum item encontrado para esse atalho. Tente outro termo depois da barra.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Anexo opcional</span>
                <input name="attachment" type="file" className="block w-full text-sm text-slate-500" />
              </label>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isSending}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                  {isSending ? "Enviando..." : "Enviar mensagem"}
                </button>

                <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <ChevronRight className="h-3.5 w-3.5" />
                  Os cards ficam clicaveis no historico para retomar a discussao depois.
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
            Nenhuma conversa disponível ainda.
          </div>
        )}
      </div>
    </section>
  );
}
