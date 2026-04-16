import path from "node:path";

const RESPONSES_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";

export type SuggestionValidationResult = {
  validationStatus: "ready" | "needs_revision";
  score: number;
  missingFields: string[];
  warnings: string[];
  fieldCorrections: string[];
  suggestedProductName: string;
  suggestedMaterial: string;
  suggestedDescription: string;
  suggestedAttributes: string[];
  normalizedSizes: string[];
  normalizedColors: string[];
};

const KNOWN_COLORS = [
  "preto",
  "branco",
  "off white",
  "bege",
  "nude",
  "caqui",
  "marrom",
  "cafe",
  "azul",
  "azul marinho",
  "azul royal",
  "verde",
  "verde militar",
  "rosa",
  "pink",
  "lilas",
  "roxo",
  "vinho",
  "bordo",
  "vermelho",
  "laranja",
  "amarelo",
  "cinza",
  "chumbo",
  "grafite",
  "dourado",
  "prata",
  "jeans"
];

const KNOWN_MATERIALS = [
  "algodao",
  "algodão",
  "viscolycra",
  "viscose",
  "canelado",
  "microfibra",
  "moletom",
  "linho",
  "suplex",
  "malha",
  "crepe",
  "tule",
  "renda",
  "jeans",
  "poliester",
  "poliéster",
  "tricoline",
  "ribana",
  "lycra",
  "courino",
  "seda",
  "modal"
];

const KNOWN_SIZES = ["pp", "p", "m", "g", "gg", "xg", "xgg", "u", "unico", "único"];

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || inferMimeType(file.name);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function inferMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text;
  }

  const outputs = Array.isArray(record.output) ? (record.output as Array<Record<string, unknown>>) : [];
  for (const output of outputs) {
    const contents = Array.isArray(output.content) ? (output.content as Array<Record<string, unknown>>) : [];
    for (const content of contents) {
      if (typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  return null;
}

const validationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "validationStatus",
    "score",
    "missingFields",
    "warnings",
    "fieldCorrections",
    "suggestedProductName",
    "suggestedMaterial",
    "suggestedDescription",
    "suggestedAttributes",
    "normalizedSizes",
    "normalizedColors"
  ],
  properties: {
    validationStatus: { type: "string", enum: ["ready", "needs_revision"] },
    score: { type: "number" },
    missingFields: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    fieldCorrections: { type: "array", items: { type: "string" } },
    suggestedProductName: { type: "string" },
    suggestedMaterial: { type: "string" },
    suggestedDescription: { type: "string" },
    suggestedAttributes: { type: "array", items: { type: "string" } },
    normalizedSizes: { type: "array", items: { type: "string" } },
    normalizedColors: { type: "array", items: { type: "string" } }
  }
} as const;

function normalizeCommaList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}

function extractKnownTerms(source: string, dictionary: string[]) {
  const lower = source.toLowerCase();
  return normalizeCommaList(
    dictionary
      .filter((item) => lower.includes(item))
      .map((item) => titleCase(item))
  );
}

function extractSizes(source: string) {
  const tokens = source
    .split(/[,;/\n\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const direct = tokens
    .map((item) => item.toLowerCase())
    .filter((item) => KNOWN_SIZES.includes(item) || /^\d{2,3}$/.test(item))
    .map((item) => (KNOWN_SIZES.includes(item) ? item.toUpperCase() : item));

  return normalizeCommaList(direct);
}

function buildFallbackSuggestionValidation(params: {
  productName: string;
  price: number;
  material: string;
  modelDescription: string;
  sizes: string[];
  colors: string[];
  frontImage?: File | null;
  backImage?: File | null;
}) {
  const mergedText = [params.productName, params.material, params.modelDescription, ...params.sizes, ...params.colors]
    .filter(Boolean)
    .join(" ");
  const normalizedSizes = normalizeCommaList([
    ...params.sizes.map((item) => item.toUpperCase()),
    ...extractSizes(mergedText)
  ]);
  const normalizedColors = normalizeCommaList([
    ...params.colors.map((item) => titleCase(item)),
    ...extractKnownTerms(mergedText, KNOWN_COLORS)
  ]);
  const inferredMaterial = normalizeCommaList([
    titleCase(params.material),
    ...extractKnownTerms(mergedText, KNOWN_MATERIALS)
  ])[0] ?? "";
  const suggestedProductName =
    params.productName.trim() ||
    [normalizedColors[0], inferredMaterial, "Moda Feminina"]
      .filter(Boolean)
      .join(" ")
      .trim();

  const fieldCorrections: string[] = [];
  if (!params.productName.trim() && suggestedProductName) {
    fieldCorrections.push("A Pepper IA sugeriu um titulo profissional para o produto a partir dos dados preenchidos.");
  }
  if ((!params.material.trim() || params.material.trim().toLowerCase() !== inferredMaterial.trim().toLowerCase()) && inferredMaterial) {
    fieldCorrections.push("Informacoes de material foram reorganizadas para o campo Material.");
  }
  if (
    normalizedColors.join(", ").toLowerCase() !== params.colors.map((item) => titleCase(item)).join(", ").toLowerCase() &&
    normalizedColors.length > 0
  ) {
    fieldCorrections.push("As cores foram padronizadas e movidas para o campo correto.");
  }
  if (
    normalizedSizes.join(", ").toLowerCase() !== params.sizes.map((item) => item.toUpperCase()).join(", ").toLowerCase() &&
    normalizedSizes.length > 0
  ) {
    fieldCorrections.push("Os tamanhos foram padronizados e movidos para o campo correto.");
  }

  const suggestedDescription =
    params.modelDescription.trim() ||
    [
      suggestedProductName,
      inferredMaterial ? `Confeccionado em ${inferredMaterial.toLowerCase()}.` : null,
      normalizedColors.length ? `Disponivel nas cores ${normalizedColors.join(", ")}.` : null,
      normalizedSizes.length ? `Grade sugerida: ${normalizedSizes.join(", ")}.` : null,
      params.price > 0 ? `Preco sugerido informado: R$ ${params.price.toFixed(2).replace(".", ",")}.` : null
    ]
      .filter(Boolean)
      .join(" ");

  const missingFields = [
    !suggestedProductName ? "Nome do produto" : null,
    !inferredMaterial ? "Material" : null,
    !params.modelDescription.trim() ? "Caracteristica / modelo" : null,
    normalizedSizes.length === 0 ? "Tamanhos" : null,
    normalizedColors.length === 0 ? "Cores" : null,
    !params.frontImage ? "Foto frente" : null,
    !params.backImage ? "Foto costas" : null
  ].filter(Boolean) as string[];

  return {
    validationStatus: missingFields.length === 0 ? "ready" : "needs_revision",
    score: Math.max(0, 100 - missingFields.length * 12),
    missingFields,
    warnings: missingFields.length ? ["Revise os campos faltantes e use fotos claras para a validacao da Pepper IA."] : [],
    fieldCorrections,
    suggestedProductName,
    suggestedMaterial: inferredMaterial,
    suggestedDescription,
    suggestedAttributes: normalizeCommaList([inferredMaterial, ...normalizedSizes, ...normalizedColors]).filter(Boolean),
    normalizedSizes,
    normalizedColors
  } satisfies SuggestionValidationResult;
}

export async function askPepperIa(params: {
  role: "ADMIN" | "SUPPLIER";
  question: string;
  context: unknown;
  history: Array<{ role: "USER" | "ASSISTANT" | "SYSTEM"; body: string }>;
  pageInfo?: {
    pageKey?: string;
    pageHint?: string | null;
  };
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada.");
  }

  const response = await fetch(RESPONSES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SUGGESTION_MODEL || DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                params.role === "ADMIN"
                  ? "Voce e a Pepper IA do painel admin. Fale como uma assistente humana, natural e profissional. Responda usando apenas o contexto fornecido, sem inventar dados. Prefira respostas curtas, conversacionais e orientadas ao que o usuario perguntou agora. Se faltar contexto, pergunte de forma simples antes de despejar informacoes. Quando houver dados de preco, faturamento, estoque, cards operacionais, financeiro, pedidos, reposicao e metricas por periodo, use isso para orientar a proxima acao do time sem virar um relatorio longo."
                  : "Voce e a Pepper IA do fornecedor. Fale como uma assistente humana, natural e profissional. Responda usando apenas o contexto do proprio fornecedor, sem expor outros fornecedores, admins ou dados globais. Prefira respostas curtas, claras e conversacionais. Se faltar contexto, faca perguntas objetivas para entender a necessidade. Quando houver cadeia entre sugestao de compra, pedido ao fornecedor, financeiro e envio, explique de forma simples em que ponto o item esta e o que o fornecedor precisa fazer agora."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                contexto: params.context,
                paginaAtual: params.pageInfo ?? null,
                historico: params.history.slice(-8),
                pergunta: params.question,
                regras: [
                  "Use apenas os dados do contexto recebido.",
                  "Se uma informacao nao estiver no contexto, diga isso com honestidade.",
                  "Nao exponha dados fora do escopo do usuario.",
                  "Converse de forma natural, como uma pessoa ajudando outra pessoa.",
                  "Prefira respostas curtas por padrao e so detalhe mais quando o usuario pedir.",
                  "Antes de listar muitos dados, verifique se isso realmente ajuda a pergunta atual.",
                  "Se fizer sentido, responda em bullets curtos e com proximos passos praticos.",
                  "Quando houver dados de preco, explique valores por variacao, produto ou visao geral do mix somente se isso estiver no contexto.",
                  "Quando houver cards operacionais, explique em que modulo o item esta, o que ja aconteceu e qual a proxima acao esperada.",
                  "Quando houver fluxo de sugestao de compra, pedido, financeiro e envio, explique a cadeia inteira de forma simples e avisando onde existe bloqueio ou pendencia.",
                  "Quando houver paginaAtual, use isso para priorizar a resposta ao que o usuario esta vendo agora.",
                  "Evite responder como jornal, dashboard narrado ou relatorio executivo quando o usuario estiver apenas conversando."
                ]
              })
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao consultar a Pepper IA (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("A Pepper IA nao retornou uma resposta utilizavel.");
  }

  return outputText;
}

export async function validateSupplierSuggestionWithIa(params: {
  productName: string;
  price: number;
  material: string;
  modelDescription: string;
  sizes: string[];
  colors: string[];
  frontImage?: File | null;
  backImage?: File | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  const normalizedSizes = params.sizes.map((item) => item.trim()).filter(Boolean);
  const normalizedColors = params.colors.map((item) => item.trim()).filter(Boolean);

  if (!apiKey) {
    return buildFallbackSuggestionValidation(params);
  }

  const imageInputs = await Promise.all(
    [params.frontImage, params.backImage]
      .filter((file): file is File => Boolean(file))
      .map(async (file) => ({
        type: "input_image" as const,
        image_url: await fileToDataUrl(file),
        detail: "high" as const
      }))
  );

  const response = await fetch(RESPONSES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SUGGESTION_MODEL || DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Voce analisa uma sugestao de produto enviada por fornecedor para um e-commerce profissional. Primeiro observe as fotos anexadas. Depois combine o que ve nas imagens com os campos digitados. Sua funcao e validar consistencia, apontar campos faltantes, reorganizar informacoes que foram digitadas no campo errado, sugerir um titulo profissional de e-commerce, melhorar a descricao e sugerir atributos uteis para cadastro. Nao sugira categoria. Retorne somente JSON valido no schema informado."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                sugestao: {
                  productName: params.productName,
                  price: params.price,
                  material: params.material,
                  modelDescription: params.modelDescription,
                  sizes: normalizedSizes,
                  colors: normalizedColors
                },
                regras: [
                  "Nao sugira categoria.",
                  "Analise as fotos antes de decidir qualquer sugestao.",
                  "A avaliacao deve focar em qualidade de preenchimento, coerencia e reaproveitamento correto das informacoes.",
                  "Se o fornecedor digitou material, cor, tamanho ou titulo no campo errado, mova isso conceitualmente para o campo certo no retorno.",
                  "O titulo sugerido deve parecer escrito por um especialista em e-commerce.",
                  "A descricao sugerida deve ser melhor que a original, profissional e pronta para cadastro.",
                  "Os atributos devem ser uteis ao time de cadastro.",
                  "Normalize tamanhos e cores mantendo o que o fornecedor quis dizer.",
                  "Use os campos suggestedProductName, suggestedMaterial e suggestedDescription ja corrigidos."
                ]
              })
            },
            ...imageInputs
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "pepper_suggestion_validation",
          strict: true,
          schema: validationSchema
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao validar sugestao com IA (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("A IA nao retornou uma validacao estruturada utilizavel.");
  }

  return JSON.parse(outputText) as SuggestionValidationResult;
}
