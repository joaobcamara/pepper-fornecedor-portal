import { PepperIaBubble } from "@/components/pepper-ia-bubble";
import { getPepperIaView } from "@/lib/pepperia-data";
import { getCurrentSession } from "@/lib/session";

export type PepperIaBubblePageKey =
  | "dashboard"
  | "products"
  | "imports"
  | "sync"
  | "suggestion"
  | "finance"
  | "orders"
  | "messages"
  | "suppliers"
  | "users"
  | "generic";

export async function PepperIaBubbleSlot({
  pageKey,
  pageHint,
  alertCount
}: {
  pageKey?: PepperIaBubblePageKey;
  pageHint?: string | null;
  alertCount?: number;
} = {}) {
  const session = await getCurrentSession();

  if (!session || (session.role !== "ADMIN" && session.role !== "SUPPLIER")) {
    return null;
  }

  const prompts =
    session.role === "ADMIN"
      ? pageKey === "finance"
        ? [
            "Quais cards estao pendentes de pagamento agora?",
            "Qual cobranca precisa de revisao hoje?",
            "Quais pedidos ja viraram financeiro e o que falta concluir?",
            "Qual produto esta travado entre pedido, financeiro e envio?"
          ]
        : pageKey === "imports"
          ? [
              "O Tiny esta pronto para importar agora?",
              "Quais fornecedores e SKUs merecem importacao primeiro?",
              "O que preciso revisar antes de salvar novos produtos?"
            ]
          : pageKey === "sync"
            ? [
                "Quais sincronizacoes falharam agora?",
                "Qual webhook pede revisao imediata?",
                "O que ainda pode impactar estoque, pedidos ou clientes?"
              ]
          : pageKey === "orders"
            ? [
                "Quais pedidos ao fornecedor estao travados agora?",
                "Quais cards ja podem seguir para o financeiro?",
              "Quais solicitacoes aprovadas viraram pedido?"
            ]
          : pageKey === "suppliers"
            ? [
                "Quais fornecedores estao incompletos ou sem produtos vinculados?",
                "Quem ainda nao pode ver valores no painel?",
                "Qual fornecedor pede revisao operacional agora?"
              ]
            : pageKey === "users"
              ? [
                  "Quais usuarios estao inativos ou sem vinculo correto?",
                  "Quem entrou por ultimo e qual perfil esta faltando revisar?",
                  "Existe algum acesso de fornecedor que precisa ajuste hoje?"
                ]
          : pageKey === "suggestion"
            ? [
                "Quais sugestoes ainda pedem revisao?",
                "Qual sugestao ja esta pronta para cadastro?",
                "Quais cards foram devolvidos para correcao?"
              ]
            : pageKey === "messages"
              ? [
                  "Quais conversas pedem retorno agora?",
                  "Qual fornecedor esta com mais assuntos pendentes?",
                  "Me resuma os principais cards e contextos compartilhados hoje."
                ]
              : pageKey === "products"
                ? [
                    "Quais produtos estao com maior risco de ruptura hoje?",
                    "Qual fornecedor tem mais SKUs criticos?",
                    "Mostre os itens com maior valor em estoque e com pedido em andamento."
                  ]
                : [
                    "Quais produtos precisam de reposicao urgente hoje?",
                    "Como esta a fila de cadastro agora?",
                    "Quais sugestoes estao pendentes de revisao?",
                    "Qual o valor do estoque e dos produtos com maior giro?"
                  ]
      : pageKey === "finance"
        ? [
            "Quais cards meus estao em revisao financeira?",
            "Qual pedido meu ja esta pago ou pendente?",
            "Quais produtos meus tem maior valor em estoque e card financeiro ativo?"
          ]
        : pageKey === "orders"
          ? [
              "Quais pedidos meus estao em preparacao?",
              "Qual card ja pode seguir para o financeiro?",
              "Quais pedidos ainda aguardam minha resposta?",
              "Qual produto meu esta mais avancado entre compra, pedido e envio?"
            ]
          : pageKey === "suggestion"
            ? [
                "Qual sugestao minha precisa de correcao?",
                "O que falta para minha sugestao ficar mais forte?",
                "Quais itens meus estao prontos para enviar?"
              ]
            : pageKey === "messages"
            ? [
                "Quais conversas minhas precisam de retorno?",
                "Me resuma o que a Pepper sinalizou hoje.",
                "Quais assuntos e cards estao pendentes no meu painel?"
              ]
            : pageKey === "products"
              ? [
                  "Quais produtos meus estao criticos agora?",
                  "Quais itens eu deveria repor primeiro?",
                  "Quais produtos meus tem maior valor, melhor giro e pedido em andamento?",
                  "Qual produto meu ja saiu da sugestao de compra e em que etapa esta agora?"
                ]
                : [
                    "Quais produtos meus estao criticos agora?",
                    "Qual sugestao minha precisa de correcao?",
                    "Quais itens eu deveria repor primeiro?",
                    "Quais produtos meus tem maior valor e melhor giro?"
                  ];

  try {
    const pepperIa = await getPepperIaView({
      userId: session.userId,
      username: session.username,
      role: session.role,
      supplierId: session.supplierId
    });

    return (
      <PepperIaBubble
        role={session.role}
        messages={pepperIa.messages}
        prompts={prompts}
        pageKey={pageKey}
        pageHint={pageHint}
        alertCount={alertCount}
      />
    );
  } catch {
    return (
      <PepperIaBubble
        role={session.role}
        messages={[]}
        prompts={prompts}
        pageKey={pageKey}
        pageHint={pageHint}
        alertCount={alertCount}
      />
    );
  }
}
