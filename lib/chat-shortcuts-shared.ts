export type ConversationShortcutItem = {
  id: string;
  referenceType: string;
  referenceId: string;
  title: string;
  subtitle: string;
  badge?: string | null;
  href?: string | null;
  metaJson?: string | null;
};

export type ConversationShortcutGroup = {
  key: string;
  label: string;
  description: string;
  items: ConversationShortcutItem[];
};

export type SlashCommandOption = {
  command: string;
  label: string;
  description: string;
  groupKey: string;
};

export type SlashSearchResult =
  | {
      mode: "commands";
      query: string;
      commandText: string;
      options: SlashCommandOption[];
    }
  | {
      mode: "items";
      query: string;
      commandText: string;
      option: SlashCommandOption;
      items: ConversationShortcutItem[];
    }
  | null;

function normalizeValue(input: string) {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getSlashCommandOptions(groups: ConversationShortcutGroup[]): SlashCommandOption[] {
  const base: SlashCommandOption[] = [
    {
      command: "produto",
      label: "Produtos",
      description: "Busca produtos e SKUs da conversa atual.",
      groupKey: "products"
    },
    {
      command: "sugestao",
      label: "Sugestoes de produto",
      description: "Mostra sugestoes recentes para anexar na conversa.",
      groupKey: "suggestions"
    },
    {
      command: "reposicao",
      label: "Reposicao",
      description: "Traz solicitacoes de reposicao relacionadas.",
      groupKey: "replenishments"
    },
    {
      command: "pedido",
      label: "Pedidos",
      description: "Lista pedidos ao fornecedor ou pedidos recebidos.",
      groupKey: "supplierOrders"
    },
    {
      command: "fornecedor",
      label: "Fornecedores",
      description: "Lista fornecedores cadastrados.",
      groupKey: "suppliers"
    },
    {
      command: "usuario",
      label: "Usuarios",
      description: "Lista usuarios cadastrados.",
      groupKey: "users"
    }
  ];

  return base.filter((option) => groups.some((group) => group.key === option.groupKey));
}

function getSearchText(item: ConversationShortcutItem) {
  return normalizeValue(
    [
      item.title,
      item.subtitle,
      item.badge,
      item.metaJson
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function getSlashSearchResult(groups: ConversationShortcutGroup[], input: string): SlashSearchResult {
  const trimmed = input.trimStart();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  const raw = trimmed.slice(1);
  const tokens = raw.split(/[\/\s]+/).filter(Boolean);
  const commandInput = normalizeValue(tokens[0] ?? "");
  const query = normalizeValue(tokens.slice(1).join(" "));
  const commandText = tokens[0] ?? "";
  const commandOptions = getSlashCommandOptions(groups);

  if (!commandInput) {
    return {
      mode: "commands",
      query: "",
      commandText,
      options: commandOptions
    };
  }

  const commandOption =
    commandOptions.find((option) => option.command === commandInput) ??
    commandOptions.find((option) => option.command.startsWith(commandInput));

  if (!commandOption) {
    return {
      mode: "commands",
      query: commandInput,
      commandText,
      options: commandOptions.filter(
        (option) =>
          normalizeValue(option.label).includes(commandInput) || option.command.includes(commandInput)
      )
    };
  }

  const group = groups.find((entry) => entry.key === commandOption.groupKey);

  if (!group) {
    return null;
  }

  const items =
    query.length === 0
      ? group.items.slice(0, 8)
      : group.items.filter((item) => getSearchText(item).includes(query)).slice(0, 8);

  return {
    mode: "items",
    query,
    commandText: commandOption.command,
    option: commandOption,
    items
  };
}
