import {
  OperationalCardOriginType,
  SupplierFinancialEntryStatus,
  SupplierOrderWorkflowStage
} from "@prisma/client";

export function getSupplierOrderWorkflowLabel(stage: SupplierOrderWorkflowStage) {
  switch (stage) {
    case "IN_PREPARATION":
      return "Em preparação";
    case "SEPARATION_CONFIRMED":
      return "Separação confirmada";
    case "READY_FOR_FINANCIAL":
      return "Pronto para financeiro";
    case "IN_FINANCIAL_REVIEW":
      return "Em revisão financeira";
    case "PAYMENT_PENDING":
      return "Pagamento pendente";
    case "PAID":
      return "Pago";
    case "SHIPPED":
      return "Enviado";
    case "NO_STOCK":
      return "Sem estoque";
    case "CANCELED":
      return "Cancelado";
    case "COMPLETED":
      return "Concluído";
    default:
      return "Aguardando resposta";
  }
}

export function getSupplierOrderNextStep(stage: SupplierOrderWorkflowStage, hasFinancialEntry = false) {
  switch (stage) {
    case "IN_PREPARATION":
      return {
        label: "Confirmar separacao",
        description: "O fornecedor precisa fechar a grade, revisar quantidades e confirmar a separacao do produto."
      };
    case "SEPARATION_CONFIRMED":
      return hasFinancialEntry
        ? {
            label: "Acompanhar revisao financeira",
            description: "A cobranca ja foi aberta e agora o proximo passo e acompanhar a revisao e o pagamento."
          }
        : {
            label: "Enviar para financeiro",
            description: "Com a separacao confirmada, o fornecedor deve anexar romaneio e nota para abrir o card financeiro."
          };
    case "READY_FOR_FINANCIAL":
      return {
        label: "Abrir cobranca",
        description: "A cobranca precisa ser enviada para revisao financeira com valor e anexos."
      };
    case "IN_FINANCIAL_REVIEW":
      return {
        label: "Aguardar revisao Pepper",
        description: "O card esta em revisao financeira no admin antes de seguir para pagamento."
      };
    case "PAYMENT_PENDING":
      return {
        label: "Aguardar pagamento",
        description: "A Pepper ja revisou a cobranca e o fluxo aguarda pagamento."
      };
    case "PAID":
      return {
        label: "Marcar envio",
        description: "Com o pagamento confirmado, o fornecedor deve finalizar o envio do pedido."
      };
    case "SHIPPED":
      return {
        label: "Concluir acompanhamento",
        description: "O pedido ja foi enviado e agora o fluxo segue para conferencias finais."
      };
    case "NO_STOCK":
      return {
        label: "Revisar com o admin",
        description: "O fornecedor informou indisponibilidade. O admin pode ajustar, cancelar ou gerar novo caminho."
      };
    case "CANCELED":
      return {
        label: "Fluxo encerrado",
        description: "O card foi cancelado e nao exige novas acoes operacionais."
      };
    case "COMPLETED":
      return {
        label: "Fluxo concluido",
        description: "Todas as etapas operacionais deste card foram concluidas."
      };
    default:
      return {
        label: "Responder e preparar",
        description: "O fornecedor precisa revisar a solicitacao inicial e iniciar a preparacao do pedido."
      };
  }
}

export function getSupplierOrderLinkedModules(stage: SupplierOrderWorkflowStage, hasFinancialEntry = false) {
  const modules = ["Pedido ao fornecedor"];

  if (
    hasFinancialEntry ||
    [
      "READY_FOR_FINANCIAL",
      "IN_FINANCIAL_REVIEW",
      "PAYMENT_PENDING",
      "PAID",
      "SHIPPED",
      "COMPLETED"
    ].includes(stage)
  ) {
    modules.push("Financeiro");
  }

  if (["SHIPPED", "COMPLETED"].includes(stage)) {
    modules.push("Envio");
  }

  return modules;
}

export function getSupplierFinancialNextStep(status: SupplierFinancialEntryStatus) {
  switch (status) {
    case "IN_REVIEW":
      return {
        label: "Admin revisa a cobranca",
        description: "A Pepper deve revisar anexos, vencimento e observacoes antes de aprovar o pagamento."
      };
    case "PENDING_PAYMENT":
      return {
        label: "Aguardar pagamento Pepper",
        description: "A cobranca foi aceita e agora aguarda a baixa ou pagamento no financeiro."
      };
    case "PAID":
      return {
        label: "Liberar envio do pedido",
        description: "O financeiro foi concluido e o pedido operacional ja pode seguir para envio."
      };
    case "REJECTED":
      return {
        label: "Corrigir documentacao",
        description: "O fornecedor precisa revisar o card, ajustar anexos ou alinhar o pedido com o admin."
      };
    case "CANCELED":
      return {
        label: "Fluxo encerrado",
        description: "A cobranca foi cancelada e nao exige novos movimentos."
      };
    default:
      return {
        label: "Enviar para revisao",
        description: "O fornecedor precisa concluir o envio do card com os anexos obrigatorios."
      };
  }
}

export function getReplenishmentNextStep(
  status: "PENDING" | "APPROVED" | "REJECTED",
  linkedOrder?: {
    orderNumber: string;
    hasFinancialEntry?: boolean;
  } | null
) {
  if (linkedOrder) {
    return {
      label: `Pedido ${linkedOrder.orderNumber} em andamento`,
      description: linkedOrder.hasFinancialEntry
        ? "A sugestao ja virou pedido operacional e tambem gerou card financeiro."
        : "A sugestao ja virou pedido operacional e segue agora no modulo de pedidos ao fornecedor."
    };
  }

  if (status === "APPROVED") {
    return {
      label: "Gerar pedido ao fornecedor",
      description: "A sugestao foi aprovada e deve aparecer no fluxo operacional de pedidos."
    };
  }

  if (status === "REJECTED") {
    return {
      label: "Fluxo encerrado",
      description: "A solicitacao foi recusada e nao segue para novos modulos."
    };
  }

  return {
    label: "Aguardar decisao do admin",
    description: "O card ainda aguarda aprovacao ou recusa da Pepper."
  };
}

export function getProductSuggestionNextStep(status: string, hasOnboardingItem: boolean) {
  if (hasOnboardingItem) {
    return {
      label: "Seguir para fila de cadastro",
      description: "A sugestao ja entrou na fila de cadastro e agora aguarda importacao e catalogo."
    };
  }

  if (status === "NEEDS_REVISION") {
    return {
      label: "Fornecedor corrige e reenvia",
      description: "A Pepper devolveu o card com observacoes e agora aguarda o fornecedor ajustar os dados."
    };
  }

  if (status === "REJECTED") {
    return {
      label: "Fluxo encerrado",
      description: "A sugestao foi reprovada e nao segue para a fila de cadastro."
    };
  }

  if (status === "APPROVED_FOR_CATALOG") {
    return {
      label: "Sincronizar cadastro",
      description: "O card foi aprovado e esta pronto para virar item da fila de cadastro."
    };
  }

  return {
    label: "Revisar e decidir",
    description: "A Pepper precisa revisar as fotos, os campos e decidir se aprova, devolve ou reprova."
  };
}

export function getSupplierOrderWorkflowTone(stage: SupplierOrderWorkflowStage) {
  switch (stage) {
    case "IN_PREPARATION":
      return "bg-sky-100 text-sky-700";
    case "SEPARATION_CONFIRMED":
      return "bg-violet-100 text-violet-700";
    case "READY_FOR_FINANCIAL":
      return "bg-amber-100 text-amber-700";
    case "IN_FINANCIAL_REVIEW":
      return "bg-indigo-100 text-indigo-700";
    case "PAYMENT_PENDING":
      return "bg-[#fff1e7] text-[#a94b25]";
    case "PAID":
      return "bg-emerald-100 text-emerald-700";
    case "SHIPPED":
      return "bg-emerald-100 text-emerald-700";
    case "NO_STOCK":
      return "bg-rose-100 text-rose-700";
    case "CANCELED":
      return "bg-slate-200 text-slate-700";
    case "COMPLETED":
      return "bg-slate-900 text-white";
    default:
      return "bg-[#fff1e7] text-[#a94b25]";
  }
}

export function getSupplierFinancialStatusLabel(status: SupplierFinancialEntryStatus) {
  switch (status) {
    case "IN_REVIEW":
      return "Em revisão";
    case "PENDING_PAYMENT":
      return "Pendente";
    case "PAID":
      return "Pago";
    case "REJECTED":
      return "Recusado";
    case "CANCELED":
      return "Cancelado";
    default:
      return "Rascunho";
  }
}

export function getSupplierFinancialStatusTone(status: SupplierFinancialEntryStatus) {
  switch (status) {
    case "IN_REVIEW":
      return "bg-indigo-100 text-indigo-700";
    case "PENDING_PAYMENT":
      return "bg-[#fff1e7] text-[#a94b25]";
    case "PAID":
      return "bg-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-rose-100 text-rose-700";
    case "CANCELED":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function getOperationalOriginLabel(originType: OperationalCardOriginType) {
  switch (originType) {
    case "PRODUCT_SUGGESTION":
      return "Sugestão de produto";
    case "REPLENISHMENT_REQUEST":
      return "Sugestão de compra";
    case "MANUAL_FINANCIAL":
      return "Financeiro manual";
    default:
      return "Pedido ao fornecedor";
  }
}
