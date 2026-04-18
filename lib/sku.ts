import {
  PEPPER_COLOR_REFERENCES,
  PEPPER_SIZE_REFERENCES,
  buildPepperReferenceMap
} from "@/lib/pepper-reference-data";

const SIZE_MAP: Record<string, string> = buildPepperReferenceMap(PEPPER_SIZE_REFERENCES);
const COLOR_MAP: Record<string, string> = buildPepperReferenceMap(PEPPER_COLOR_REFERENCES);

export type ParsedSku = {
  raw: string;
  quantityCode: string;
  baseCode: string;
  sizeCode?: string;
  colorCode?: string;
  kind: "parent" | "variant";
};

export function normalizeSku(value: string) {
  return value.trim().toUpperCase();
}

export function parseSku(value: string): ParsedSku | null {
  const sku = normalizeSku(value);
  const parts = sku.split("-");

  if (parts.length === 2) {
    return {
      raw: sku,
      quantityCode: parts[0],
      baseCode: parts[1],
      kind: "parent"
    };
  }

  if (parts.length === 4) {
    return {
      raw: sku,
      quantityCode: parts[0],
      baseCode: parts[1],
      sizeCode: parts[2],
      colorCode: parts[3],
      kind: "variant"
    };
  }

  return null;
}

export function getParentSku(value: string) {
  const parsed = parseSku(value);

  if (!parsed) {
    return null;
  }

  return `${parsed.quantityCode}-${parsed.baseCode}`;
}

export function getSizeLabel(code?: string | null) {
  if (!code) {
    return "Sem tamanho";
  }

  return SIZE_MAP[code] ?? code;
}

function getColorComplementLabel(code: string, productName?: string | null) {
  if (code.length <= 2) {
    return null;
  }

  const complement = code.slice(-2);
  const normalizedName = productName?.trim().toLowerCase() ?? "";

  if (complement === "80") {
    if (normalizedName.includes("calcinha")) {
      return "Fio dental";
    }

    if (
      normalizedName.includes("cinta") ||
      normalizedName.includes("corpete") ||
      normalizedName.includes("barbatana")
    ) {
      return "4 Barbatanas";
    }
  }

  if (complement === "81") {
    if (normalizedName.includes("calcinha")) {
      return "Tradicional";
    }

    if (
      normalizedName.includes("cinta") ||
      normalizedName.includes("corpete") ||
      normalizedName.includes("barbatana")
    ) {
      return "12 Barbatanas";
    }
  }

  return null;
}

export function getColorLabel(code?: string | null, productName?: string | null) {
  if (!code) {
    return "Sem cor";
  }
  const normalized = normalizeSku(code);
  const direct = COLOR_MAP[normalized];

  if (direct) {
    return direct;
  }

  if (normalized.length > 2) {
    const baseColorCode = normalized.slice(0, 2);
    const baseColor = COLOR_MAP[baseColorCode];
    const complementLabel = getColorComplementLabel(normalized, productName);

    if (baseColor && complementLabel) {
      return `${baseColor} ${complementLabel}`;
    }
  }

  return normalized;
}

export function formatVariantLabel(color?: string | null, size?: string | null) {
  const safeColor = color?.trim() || "Sem cor";
  const safeSize = size?.trim() || "Sem tamanho";
  return `${safeColor} - ${safeSize}`;
}
