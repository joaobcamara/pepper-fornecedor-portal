import { getColorLabel, getSizeLabel } from "@/lib/sku";
import { getStockBand, getStockBandLabel } from "@/lib/stock";

type Variant = {
  sku: string;
  sizeCode: string;
  colorCode: string;
  quantity: number | null;
};

type Product = {
  id: string;
  supplier: string;
  name: string;
  sku: string;
  imageUrl: string;
  lastUpdated: string;
  syncState: "fresh" | "stale";
  variants: Variant[];
};

const products: Product[] = [
  {
    id: "prod-2504",
    supplier: "Luna Têxtil",
    name: "Conjunto Fitness Aura",
    sku: "01-2504",
    imageUrl: "/brand/pepper-logo.png",
    lastUpdated: "Atualizado há 2 min",
    syncState: "fresh",
    variants: [
      { sku: "01-2504-21-01", sizeCode: "21", colorCode: "01", quantity: 3 },
      { sku: "01-2504-22-01", sizeCode: "22", colorCode: "01", quantity: 7 },
      { sku: "01-2504-23-01", sizeCode: "23", colorCode: "01", quantity: 0 },
      { sku: "01-2504-21-03", sizeCode: "21", colorCode: "03", quantity: 2 },
      { sku: "01-2504-22-03", sizeCode: "22", colorCode: "03", quantity: 6 }
    ]
  },
  {
    id: "prod-1187",
    supplier: "Luna Têxtil",
    name: "Top Essential Soft",
    sku: "01-1187",
    imageUrl: "/brand/pepper-logo.png",
    lastUpdated: "Atualizado há 17 min",
    syncState: "stale",
    variants: [
      { sku: "01-1187-21-16", sizeCode: "21", colorCode: "16", quantity: 2 },
      { sku: "01-1187-22-16", sizeCode: "22", colorCode: "16", quantity: 1 },
      { sku: "01-1187-23-16", sizeCode: "23", colorCode: "16", quantity: null }
    ]
  }
];

export function getSupplierDashboardData() {
  return products.map((product) => {
    const total = product.variants.reduce((sum, variant) => sum + (variant.quantity ?? 0), 0);
    const band = getStockBand(total);
    const grouped = product.variants.reduce<Record<string, Variant[]>>((acc, variant) => {
      const color = getColorLabel(variant.colorCode);
      acc[color] ??= [];
      acc[color].push(variant);
      return acc;
    }, {});

    const matrix = Object.entries(grouped).map(([color, colorVariants]) => ({
      color,
      items: colorVariants.map((variant) => ({
        ...variant,
        size: getSizeLabel(variant.sizeCode),
        colorLabel: getColorLabel(variant.colorCode),
        status: getStockBandLabel(getStockBand(variant.quantity))
      }))
    }));

    return {
      ...product,
      total,
      band,
      bandLabel: getStockBandLabel(band),
      matrix
    };
  });
}
