const SIZE_MAP: Record<string, string> = {
  "01": "1 ano",
  "02": "2 anos",
  "03": "3 anos",
  "04": "4 anos",
  "06": "6 anos",
  "08": "8 anos",
  "10": "10 anos",
  "12": "12 anos",
  "14": "14 anos",
  "16": "16 anos",
  "20": "PP",
  "21": "P",
  "22": "M",
  "23": "G",
  "24": "GG",
  "25": "XGG",
  "26": "Unico",
  "27": "Variado",
  "28": "Combinei",
  "36": "36",
  "37": "37",
  "38": "38",
  "40": "40",
  "42": "42",
  "44": "44",
  "46": "46",
  "48": "48",
  "50": "50",
  "52": "52",
  "54": "54",
  "56": "56"
};

const COLOR_MAP: Record<string, string> = {
  "01": "Preto",
  "02": "Bege",
  "03": "Vermelho",
  "04": "Amarelo",
  "05": "Rosa",
  "06": "Verde",
  "07": "Pink",
  "08": "Rose",
  "09": "Cinza",
  "10": "Azul Royal",
  "11": "Azul Marinho",
  "12": "Verde Militar",
  "13": "Esmeralda",
  "14": "Vinho",
  "15": "Grafite",
  "16": "Branco",
  "17": "Variadas",
  "18": "Claro",
  "19": "Escuro",
  "20": "Combinei",
  "21": "Laranja",
  "22": "Azul",
  "27": "Roxo",
  "29": "Marrom",
  "30": "Verde Folha",
  "31": "Acai",
  "44": "Satin",
  "52": "Salmao",
  "54": "Fucsia",
  "55": "Lilas",
  "56": "Verde Azulado",
  "57": "Verde Claro",
  "58": "Telha",
  "59": "Verde Abacate",
  "60": "Azul Claro",
  "61": "Rosa Choque",
  "62": "Chumbo",
  "63": "Rosa Claro",
  "64": "Verde Agua",
  "65": "Azul Turquesa",
  "66": "Verde Musgo",
  "67": "Verde Bandeira",
  "68": "Verde Lima",
  "69": "Amarelo Claro",
  "70": "Violeta",
  "73": "Rosa Bebe",
  "79": "Azul Bebe",
  "82": "Mostarda",
  "84": "Goiaba",
  "86": "Magenta",
  "87": "Cinza Azulado",
  "88": "Azul Jeans",
  "89": "Azul Bic",
  "90": "Azul Violeta",
  "91": "Areia",
  "92": "Verde Tiffany",
  "93": "Verde Menta"
};

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

export function getColorLabel(code?: string | null) {
  if (!code) {
    return "Sem cor";
  }

  return COLOR_MAP[code] ?? code;
}

export function formatVariantLabel(color?: string | null, size?: string | null) {
  const safeColor = color?.trim() || "Sem cor";
  const safeSize = size?.trim() || "Sem tamanho";
  return `${safeColor} - ${safeSize}`;
}
