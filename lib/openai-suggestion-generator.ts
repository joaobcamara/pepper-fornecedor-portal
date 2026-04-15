import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ProductSuggestion, ProductSuggestionColor, ProductSuggestionImage, ProductSuggestionSize, Supplier } from "@prisma/client";
import { createTinyLikeDraft, normalizeTinyLikeDraft, type TinyLikeDraft } from "@/lib/tiny-like-draft";

type SuggestionWithRelations = ProductSuggestion & {
  supplier: Supplier;
  images: ProductSuggestionImage[];
  sizes: ProductSuggestionSize[];
  colors: ProductSuggestionColor[];
};

const RESPONSES_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";

const tinyLikeDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tabs", "general", "complementary", "technical", "variations", "prices", "other"],
  properties: {
    tabs: {
      type: "array",
      items: { type: "string" }
    },
    general: {
      type: "object",
      additionalProperties: false,
      required: [
        "type",
        "productName",
        "skuReference",
        "salePrice",
        "promotionalPrice",
        "origin",
        "unit",
        "supplierName",
        "gtin",
        "ncm",
        "category",
        "brand"
      ],
      properties: {
        type: { type: "string" },
        productName: { type: "string" },
        skuReference: { type: "string" },
        salePrice: { type: "string" },
        promotionalPrice: { type: "string" },
        origin: { type: "string" },
        unit: { type: "string" },
        supplierName: { type: "string" },
        gtin: { type: "string" },
        ncm: { type: "string" },
        category: { type: "string" },
        brand: { type: "string" }
      }
    },
    complementary: {
      type: "object",
      additionalProperties: false,
      required: [
        "material",
        "modelDescription",
        "complementaryDescription",
        "seoKeywords",
        "seoTitle",
        "seoDescription",
        "videoUrl",
        "slug"
      ],
      properties: {
        material: { type: "string" },
        modelDescription: { type: "string" },
        complementaryDescription: { type: "string" },
        seoKeywords: { type: "string" },
        seoTitle: { type: "string" },
        seoDescription: { type: "string" },
        videoUrl: { type: "string" },
        slug: { type: "string" }
      }
    },
    technical: {
      type: "object",
      additionalProperties: false,
      required: ["packageType", "packageProfile", "netWeight", "grossWeight", "volumes", "width", "height", "length"],
      properties: {
        packageType: { type: "string" },
        packageProfile: { type: "string" },
        netWeight: { type: "string" },
        grossWeight: { type: "string" },
        volumes: { type: "string" },
        width: { type: "string" },
        height: { type: "string" },
        length: { type: "string" }
      }
    },
    variations: {
      type: "object",
      additionalProperties: false,
      required: ["sizes", "colors", "rows"],
      properties: {
        sizes: {
          type: "array",
          items: { type: "string" }
        },
        colors: {
          type: "array",
          items: { type: "string" }
        },
        rows: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["variationLabel", "size", "color", "sku", "price", "promotionalPrice", "stock", "imageStatus", "note"],
            properties: {
              variationLabel: { type: "string" },
              size: { type: "string" },
              color: { type: "string" },
              sku: { type: "string" },
              price: { type: "string" },
              promotionalPrice: { type: "string" },
              stock: { type: "string" },
              imageStatus: { type: "string" },
              note: { type: "string" }
            }
          }
        }
      }
    },
    prices: {
      type: "object",
      additionalProperties: false,
      required: ["costPrice", "minimumPrice", "marginNotes"],
      properties: {
        costPrice: { type: "string" },
        minimumPrice: { type: "string" },
        marginNotes: { type: "string" }
      }
    },
    other: {
      type: "object",
      additionalProperties: false,
      required: ["internalNotes", "aiInstructions", "cadastroChecklist", "aiSummary", "aiWarnings", "visualHighlights"],
      properties: {
        internalNotes: { type: "string" },
        aiInstructions: { type: "string" },
        cadastroChecklist: {
          type: "array",
          items: { type: "string" }
        },
        aiSummary: { type: "string" },
        aiWarnings: {
          type: "array",
          items: { type: "string" }
        },
        visualHighlights: {
          type: "array",
          items: { type: "string" }
        }
      }
    }
  }
} as const;

function resolveLocalImagePath(fileUrl: string) {
  return path.join(process.cwd(), "public", fileUrl.replace(/^\/+/, "").replace(/\//g, path.sep));
}

async function imageFileToDataUrl(image: ProductSuggestionImage) {
  const absolutePath = resolveLocalImagePath(image.fileUrl);
  const buffer = await readFile(absolutePath);
  const mimeType = image.mimeType || inferMimeType(image.fileName);
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

function buildPromptContext(suggestion: SuggestionWithRelations) {
  const frontImage = suggestion.images.find((image) => image.type === "FRONT");
  const backImage = suggestion.images.find((image) => image.type === "BACK");

  return {
    supplierName: suggestion.supplier.name,
    productName: suggestion.adminDraftName ?? suggestion.productName,
    price: suggestion.adminDraftPrice ?? suggestion.price,
    material: suggestion.adminDraftMaterial ?? suggestion.material,
    modelDescription: suggestion.adminDraftModel ?? suggestion.modelDescription,
    sizes: suggestion.sizes.map((size) => size.label),
    colors: suggestion.colors.map((color) => color.label),
    frontImage,
    backImage
  };
}

export async function generateTinyLikeDraftWithOpenAI(suggestion: SuggestionWithRelations): Promise<TinyLikeDraft> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada.");
  }

  const context = buildPromptContext(suggestion);
  const baseDraft = createTinyLikeDraft({
    productName: context.productName,
    price: context.price,
    material: context.material,
    modelDescription: context.modelDescription,
    sizes: context.sizes,
    colors: context.colors,
    supplierName: context.supplierName
  });

  const imageContents = await Promise.all(
    suggestion.images
      .filter((image) => image.type === "FRONT" || image.type === "BACK")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(async (image) => ({
        type: "input_image" as const,
        image_url: await imageFileToDataUrl(image),
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
                "Voce recebe a sugestao de um fornecedor e deve preencher um pre-cadastro no estilo Tiny para a equipe da Pepper. Preserve os tamanhos e cores enviados. Seja especialmente forte em categoria, descricao comercial, SEO e checklist operacional. Nao invente GTIN, NCM, marca ou SKU quando nao houver evidencia; use string vazia nesses casos. Use as imagens para inferir tipo de peça, acabamento, estilo visual, modelagem e possiveis destaques comerciais. Retorne somente JSON valido no schema informado."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                objetivo:
                  "Montar uma ficha completa de pre-cadastro para revisao humana e futura integracao com o Tiny, usando fotos e dados estruturados do fornecedor.",
                contexto: {
                  supplierName: context.supplierName,
                  productName: context.productName,
                  salePrice: context.price,
                  material: context.material,
                  modelDescription: context.modelDescription,
                  sizes: context.sizes,
                  colors: context.colors
                },
                regras: [
                  "Mantenha os tamanhos e cores exatamente como enviados.",
                  "Nao invente GTIN, NCM, marca ou codigo de referencia se nao houver evidencia.",
                  "Sugira categoria em formato util para Tiny, de preferencia com hierarquia quando houver boa confianca.",
                  "Escreva descricao complementar com tom comercial, claro, objetivo e pronto para cadastro.",
                  "Crie SEO title, SEO description e keywords melhores que o texto base quando houver contexto visual suficiente.",
                  "Preencha aiSummary com um resumo executivo rapido para o admin validar em poucos segundos.",
                  "Preencha aiWarnings com riscos, ausencias ou pontos que exigem validacao humana.",
                  "Preencha visualHighlights com observacoes concretas percebidas nas imagens.",
                  "O preco das variacoes deve acompanhar o preco base, a menos que exista um bom motivo para sugerir promocional.",
                  "A descricao complementar deve ser comercial, clara e util para cadastro.",
                  "O checklist precisa ajudar a equipe de cadastro da Pepper."
                ],
                estruturaBase: baseDraft
              })
            },
            ...imageContents
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "pepper_suggestion_draft",
          strict: true,
          schema: tinyLikeDraftSchema
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao gerar ficha com OpenAI (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("A OpenAI nao retornou uma resposta estruturada utilizavel.");
  }

  return normalizeTinyLikeDraft(JSON.parse(outputText), {
    productName: context.productName,
    price: context.price,
    material: context.material,
    modelDescription: context.modelDescription,
    sizes: context.sizes,
    colors: context.colors,
    supplierName: context.supplierName
  });
}
