"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  Download,
  LoaderCircle,
  MessageCircle,
  PackagePlus,
  RefreshCw,
  Search,
  Sparkles,
  X
} from "lucide-react";
import { downloadHtmlFile, openWhatsAppShare } from "@/lib/browser-share";
import { AdminImportConsole } from "@/components/admin-import-console";
import { ProductOperationalStrip } from "@/components/product-operational-strip";
import { cn } from "@/lib/cn";
import { suggestPurchaseQuantity, summarizePurchaseSuggestions } from "@/lib/reorder-advisor";
import { SALES_PERIOD_OPTIONS, safeCoverageDays, type SalesPeriodKey, type SalesPeriodTotals } from "@/lib/sales-metrics";

type SupplierOption = {
  id: string;
  name: string;
  slug: string;
};

type VariantRow = {
  id: string;
  sku: string;
  sizeCode: string | null;
  sizeLabel: string;
  colorCode: string | null;
  colorLabel: string;
  quantity: number | null;
  reservedStock?: number | null;
  band: "critical" | "low" | "ok" | "unknown";
  sales: SalesPeriodTotals;
  sales15d: number;
  unitCost: number | null;
  criticalStockThreshold: number | null;
  lowStockThreshold: number | null;
  effectiveCriticalStockThreshold: number;
  effectiveLowStockThreshold: number;
};

type ProductGroup = {
  id: string;
  parentSku: string;
  internalName: string;
  imageUrl: string;
  active: boolean;
  criticalStockThreshold: number | null;
  lowStockThreshold: number | null;
  variantCount: number;
  totalStock: number;
  totalReservedStock?: number;
  totalEstimatedCost: number;
  staleCount: number;
  band: "critical" | "low" | "ok" | "unknown";
  bandLabel: string;
  sales: SalesPeriodTotals;
  coverageDays: number | null;
  movementBadge: string;
  topColorLabel: string | null;
  topSizeLabel: string | null;
  supplierIds: string[];
  suppliers: Array<{
    id: string;
    name: string;
    supplierSalePrice?: number | null;
    criticalStockThreshold?: number | null;
    lowStockThreshold?: number | null;
  }>;
  accountSummaries?: Array<{
    accountKey: "pepper" | "showlook" | "onshop";
    label: string;
    logoUrl: string;
    hasListing: boolean;
    hasSignal: boolean;
    salesToday: number;
    sales7d: number;
    sales15d: number;
    sales30d: number;
    salesTotal: number;
  }>;
  updatedAt: string;
  relatedOrderCount: number;
  replenishmentCard: {
    requestId: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    statusLabel: string;
    linkedOrderNumber: string | null;
    linkedFinancialStatusLabel: string | null;
    nextStepLabel: string;
    supplierName: string;
  } | null;
  activeOrder: {
    orderId: string;
    orderNumber: string;
    workflowStage: string;
    workflowStageLabel: string;
    financialStatus: string | null;
    financialStatusLabel: string | null;
    supplierName: string;
    originLabel: string;
  } | null;
  variants: VariantRow[];
};

type DashboardSummary = {
  productCount: number;
  staleCount: number;
  totalSalesToday: number;
  totalSales7d: number;
  totalSales30d: number;
  atRiskCount: number;
  replenishmentPendingCount: number;
  orderCardsInProgress: number;
  readyForFinancialCount: number;
  financialReviewCount: number;
  paymentPendingCount: number;
};

const DEFAULT_ACCOUNT_SUMMARIES: NonNullable<ProductGroup["accountSummaries"]> = [
  {
    accountKey: "pepper",
    label: "Pepper",
    logoUrl: "/brand/accounts/pepper.png",
    hasListing: false,
    hasSignal: false,
    salesToday: 0,
    sales7d: 0,
    sales15d: 0,
    sales30d: 0,
    salesTotal: 0
  },
  {
    accountKey: "showlook",
    label: "Show Look",
    logoUrl: "/brand/accounts/showlook.png",
    hasListing: false,
    hasSignal: false,
    salesToday: 0,
    sales7d: 0,
    sales15d: 0,
    sales30d: 0,
    salesTotal: 0
  },
  {
    accountKey: "onshop",
    label: "On Shop",
    logoUrl: "/brand/accounts/onshop.png",
    hasListing: false,
    hasSignal: false,
    salesToday: 0,
    sales7d: 0,
    sales15d: 0,
    sales30d: 0,
    salesTotal: 0
  }
];

type GroupDraft = {
  internalName: string;
  active: boolean;
  supplierIds: string[];
  criticalStockThreshold: string;
  lowStockThreshold: string;
  variants: Record<
    string,
    {
      criticalStockThreshold: string;
      lowStockThreshold: string;
    }
  >;
};

function toInputValue(value: number | null) {
  return value === null ? "" : String(value);
}

function toNullableNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  return Number(value);
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function isBrandFallbackImage(imageUrl?: string | null) {
  return !imageUrl || imageUrl === "/brand/pepper-logo.png";
}

function bandTone(band: ProductGroup["band"]) {
  if (band === "critical") return "border-rose-200 bg-rose-50/80";
  if (band === "low") return "border-amber-200 bg-amber-50/80";
  if (band === "ok") return "border-emerald-200 bg-emerald-50/70";
  return "border-slate-200 bg-white/80";
}

function bandBadgeTone(band: ProductGroup["band"] | VariantRow["band"]) {
  if (band === "critical") return "bg-rose-100 text-rose-700";
  if (band === "low") return "bg-amber-100 text-amber-700";
  if (band === "ok") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

function shortenProductTitle(value: string, words = 3) {
  const parts = value.trim().split(/\s+/);
  if (parts.length <= words) {
    return value;
  }

  return `${parts.slice(0, words).join(" ")}...`;
}

function describeSalesRhythm(params: { sales7d: number; sales15d: number; sales30d: number }) {
  const pace7d = params.sales7d / 7;
  const pace15d = params.sales15d / 15;
  const pace30d = params.sales30d / 30;

  if (params.sales30d <= 0 && params.sales15d <= 0 && params.sales7d <= 0) {
    return {
      title: "Base curta de giro",
      description: "A Pepper IA vai cair no modo conservador porque ainda nao ha historico suficiente nesta familia.",
      tone: "border-slate-200 bg-slate-50 text-slate-700"
    };
  }

  if (pace7d >= pace15d * 1.12 || pace15d >= pace30d * 1.08) {
    return {
      title: "Acelerando",
      description: "O giro recente esta acima do ritmo medio. A Pepper IA vai dar mais peso para os ultimos 7 e 15 dias.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700"
    };
  }

  if (pace7d <= pace15d * 0.88 && pace15d <= pace30d * 0.92) {
    return {
      title: "Desacelerando",
      description: "O giro perdeu forca no curto prazo. A Pepper IA vai reduzir a agressividade da sugestao para evitar excesso.",
      tone: "border-amber-200 bg-amber-50 text-amber-800"
    };
  }

  return {
    title: "Ritmo estavel",
    description: "Os ultimos 7, 15 e 30 dias estao coerentes. A Pepper IA pode sugerir reposicao com leitura equilibrada.",
    tone: "border-slate-200 bg-slate-50 text-slate-700"
  };
}

function describeVariantDemandSignal(params: {
  salesToday: number;
  sales7d: number;
  sales15d: number;
  sales30d: number;
  maxSales30d: number;
  averageSales30d: number;
}) {
  const recentPace = params.sales7d / 7;
  const midPace = Math.max(params.sales15d / 15, params.sales30d / 30, 0);

  if (params.salesToday <= 0 && params.sales7d <= 0 && params.sales30d <= 0) {
    return {
      label: "Sem giro",
      description: "Sem vendas recentes",
      tone: "bg-slate-100 text-slate-600"
    };
  }

  if (params.sales30d > 0 && params.sales30d === params.maxSales30d) {
    return {
      label: "Mais forte",
      description: "Lider deste produto",
      tone: "bg-emerald-100 text-emerald-700"
    };
  }

  if (recentPace > 0 && recentPace >= midPace * 1.15) {
    return {
      label: "Acelerando",
      description: "Curto prazo acima da media",
      tone: "bg-sky-100 text-sky-700"
    };
  }

  if (params.sales30d >= Math.max(1, params.averageSales30d * 1.2)) {
    return {
      label: "Giro forte",
      description: "Acima da media do mix",
      tone: "bg-violet-100 text-violet-700"
    };
  }

  if (midPace > 0 && recentPace <= midPace * 0.85) {
    return {
      label: "Desacelerando",
      description: "Curto prazo abaixo da media",
      tone: "bg-amber-100 text-amber-700"
    };
  }

  return {
    label: "Estavel",
    description: "Fluxo consistente",
    tone: "bg-slate-100 text-slate-700"
  };
}

function accountPresenceTone(summary: {
  hasListing: boolean;
  hasSignal: boolean;
  salesTotal: number;
}) {
  if (summary.hasSignal || summary.salesTotal > 0) {
    return "border-[#f0ceb7] bg-[#fff8f1] text-slate-900";
  }

  if (summary.hasListing) {
    return "border-slate-200 bg-slate-50 text-slate-500";
  }

  return "border-slate-200 bg-slate-50/70 text-slate-400";
}

function ProductReferenceThumbnail({
  imageUrl,
  alt,
  sku,
  size = "card",
  onClick
}: {
  imageUrl: string;
  alt: string;
  sku: string;
  size?: "card" | "hero" | "panel";
  onClick?: (() => void) | null;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedImageUrl = !failed && imageUrl ? imageUrl : "/brand/pepper-logo.png";
  const fallback = isBrandFallbackImage(resolvedImageUrl);
  const dimensionClassName =
    size === "hero"
      ? "h-44 w-44 rounded-[2.2rem]"
      : size === "panel"
        ? "h-28 w-28 rounded-[1.85rem]"
        : "h-28 w-28 rounded-[1.85rem]";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ?? undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "relative shrink-0 overflow-hidden border shadow-inner transition",
        dimensionClassName,
        onClick ? "cursor-zoom-in hover:scale-[1.02]" : "cursor-default",
        fallback ? "border-[#f3d5c3] bg-[#fff7f1]" : "border-white/80 bg-white"
      )}
    >
      <img
        src={resolvedImageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("h-full w-full", fallback ? "object-contain p-3" : "object-cover")}
      />
      {fallback ? (
        <div className="absolute inset-x-3 bottom-3">
          <span className="inline-flex items-center rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b25a31]">
            {sku}
          </span>
        </div>
      ) : null}
    </div>
  );
}

const PRODUCT_ORDER_FLASH_KEY = "admin-product-inventory:flash";

export function AdminProductInventoryManager({
  suppliers,
  productGroups,
  dashboard,
  tinyConfigured,
  initialSkuQuery = "",
  initialSelectedSku = null,
  initialSupplierId = "all"
}: {
  suppliers: SupplierOption[];
  productGroups: ProductGroup[];
  dashboard: DashboardSummary;
  tinyConfigured: boolean;
  initialSkuQuery?: string;
  initialSelectedSku?: string | null;
  initialSupplierId?: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>(() =>
    Object.fromEntries(
      productGroups.map((group) => [
        group.parentSku,
        {
          internalName: group.internalName,
          active: group.active,
          supplierIds: group.supplierIds,
          criticalStockThreshold: toInputValue(group.criticalStockThreshold),
          lowStockThreshold: toInputValue(group.lowStockThreshold),
          variants: Object.fromEntries(
            group.variants.map((variant) => [
              variant.sku,
              {
                criticalStockThreshold: toInputValue(variant.criticalStockThreshold),
                lowStockThreshold: toInputValue(variant.lowStockThreshold)
              }
            ])
          )
        }
      ])
    )
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId);
  const [skuQuery, setSkuQuery] = useState(initialSkuQuery);
  const [activePeriod, setActivePeriod] = useState<SalesPeriodKey>("1m");
  const [selectedSku, setSelectedSku] = useState<string | null>(
    initialSelectedSku && productGroups.some((group) => group.parentSku === initialSelectedSku) ? initialSelectedSku : null
  );
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingSku, setSavingSku] = useState<string | null>(null);
  const [orderSupplierId, setOrderSupplierId] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);
  const [orderFeedbackTone, setOrderFeedbackTone] = useState<"success" | "warning">("success");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [reconcilingSku, setReconcilingSku] = useState<string | null>(null);
  const [reconcileFeedback, setReconcileFeedback] = useState<string | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  useEffect(() => {
    const flash = window.sessionStorage.getItem(PRODUCT_ORDER_FLASH_KEY);

    if (flash) {
      setFeedback(flash);
      window.sessionStorage.removeItem(PRODUCT_ORDER_FLASH_KEY);
    }
  }, []);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = skuQuery.trim().toLowerCase();
    return productGroups.filter((group) => {
      const matchesSupplier = selectedSupplierId === "all" || group.supplierIds.includes(selectedSupplierId);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        group.parentSku.toLowerCase().includes(normalizedQuery) ||
        group.internalName.toLowerCase().includes(normalizedQuery) ||
        group.variants.some((variant) => variant.sku.toLowerCase().includes(normalizedQuery));
      return matchesSupplier && matchesQuery;
    });
  }, [productGroups, selectedSupplierId, skuQuery]);

  const selectedGroup = useMemo(
    () => productGroups.find((group) => group.parentSku === selectedSku) ?? null,
    [productGroups, selectedSku]
  );

  const selectedDraft = selectedGroup ? drafts[selectedGroup.parentSku] : null;

  const selectedSales15d = useMemo(
    () => (selectedGroup ? selectedGroup.variants.reduce((sum, variant) => sum + variant.sales15d, 0) : 0),
    [selectedGroup]
  );

  const selectedVariantSalesAverage30d = useMemo(() => {
    if (!selectedGroup || selectedGroup.variants.length === 0) {
      return 0;
    }

    return selectedGroup.variants.reduce((sum, variant) => sum + variant.sales["1m"], 0) / selectedGroup.variants.length;
  }, [selectedGroup]);

  const selectedVariantSalesMax30d = useMemo(
    () =>
      selectedGroup
        ? selectedGroup.variants.reduce((highest, variant) => Math.max(highest, variant.sales["1m"]), 0)
        : 0,
    [selectedGroup]
  );

  const selectedReadableVariantCount = useMemo(
    () => (selectedGroup ? selectedGroup.variants.filter((variant) => variant.quantity !== null).length : 0),
    [selectedGroup]
  );

  const selectedSalesRhythm = useMemo(
    () =>
      selectedGroup
        ? describeSalesRhythm({
            sales7d: selectedGroup.sales["7d"],
            sales15d: selectedSales15d,
            sales30d: selectedGroup.sales["1m"]
          })
        : null,
    [selectedGroup, selectedSales15d]
  );

  const sizes = useMemo(
    () => (selectedGroup ? Array.from(new Set(selectedGroup.variants.map((variant) => variant.sizeLabel))) : []),
    [selectedGroup]
  );

  const matrix = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    const colors = Array.from(new Set(selectedGroup.variants.map((variant) => variant.colorLabel)));
    return colors.map((color) => ({
      color,
      items: sizes.map(
        (size) => selectedGroup.variants.find((variant) => variant.colorLabel === color && variant.sizeLabel === size) ?? null
      )
    }));
  }, [selectedGroup, sizes]);

  const isSingleSizeGroup = sizes.length === 1;

  const selectableSuppliers = useMemo(() => {
    if (!selectedDraft || selectedDraft.supplierIds.length === 0) {
      return suppliers;
    }

    return suppliers.filter((supplier) => selectedDraft.supplierIds.includes(supplier.id));
  }, [selectedDraft, suppliers]);

  const selectedLinkedSupplier = useMemo(() => {
    if (!selectedGroup) {
      return null;
    }

    return (
      selectedGroup.suppliers.find((supplier) => supplier.id === orderSupplierId) ??
      selectedGroup.suppliers[0] ??
      null
    );
  }, [orderSupplierId, selectedGroup]);

  const estimatedOrderTotal = useMemo(() => {
    if (!selectedGroup) {
      return 0;
    }

    return selectedGroup.variants.reduce(
      (sum, variant) => sum + (orderQuantities[variant.sku] ?? 0) * (variant.unitCost ?? 0),
      0
    );
  }, [orderQuantities, selectedGroup]);

  const orderVariantCount = useMemo(
    () => Object.values(orderQuantities).filter((value) => value > 0).length,
    [orderQuantities]
  );

  const pepperIaSummary = useMemo(() => {
    if (!selectedGroup) {
      return null;
    }

    const results = selectedGroup.variants.map((variant) =>
      suggestPurchaseQuantity({
        currentStock: variant.quantity,
        sales1d: variant.sales["1d"],
        sales7d: variant.sales["7d"],
        sales15d: variant.sales15d,
        sales30d: variant.sales["1m"],
        criticalStockThreshold:
          toNullableNumber(selectedDraft?.variants[variant.sku]?.criticalStockThreshold ?? "") ??
          toNullableNumber(selectedDraft?.criticalStockThreshold ?? "") ??
          variant.effectiveCriticalStockThreshold,
        lowStockThreshold:
          toNullableNumber(selectedDraft?.variants[variant.sku]?.lowStockThreshold ?? "") ??
          toNullableNumber(selectedDraft?.lowStockThreshold ?? "") ??
          variant.effectiveLowStockThreshold
      })
    );

    return summarizePurchaseSuggestions(results);
  }, [selectedDraft, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) {
      return;
    }

    setOrderSupplierId(selectedGroup.supplierIds[0] ?? "");
    setOrderNote("");
    setOrderQuantities({});
    setOrderFeedback(null);
    setOrderFeedbackTone("success");
    setOrderError(null);
    setReconcileFeedback(null);
    setReconcileError(null);
  }, [selectedGroup, suppliers]);

  function updateDraft(parentSku: string, patch: Partial<GroupDraft>) {
    setDrafts((current) => ({
      ...current,
      [parentSku]: {
        ...current[parentSku],
        ...patch
      }
    }));
  }

  function updateVariantDraft(
    parentSku: string,
    sku: string,
    field: "criticalStockThreshold" | "lowStockThreshold",
    value: string
  ) {
    setDrafts((current) => ({
      ...current,
      [parentSku]: {
        ...current[parentSku],
        variants: {
          ...current[parentSku].variants,
          [sku]: {
            ...current[parentSku].variants[sku],
            [field]: value
          }
        }
      }
    }));
  }

  async function saveGroup(group: ProductGroup) {
    const draft = drafts[group.parentSku];
    setFeedback(null);
    setError(null);
    setSavingSku(group.parentSku);

    try {
      const response = await fetch("/api/admin/products/configure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parentSku: group.parentSku,
          internalName: draft.internalName,
          active: draft.active,
          supplierIds: draft.supplierIds,
          criticalStockThreshold: toNullableNumber(draft.criticalStockThreshold),
          lowStockThreshold: toNullableNumber(draft.lowStockThreshold),
          variantThresholds: group.variants.map((variant) => ({
            sku: variant.sku,
            criticalStockThreshold: toNullableNumber(draft.variants[variant.sku]?.criticalStockThreshold ?? ""),
            lowStockThreshold: toNullableNumber(draft.variants[variant.sku]?.lowStockThreshold ?? "")
          }))
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        verification?: {
          storedInFoundation: boolean;
          visibleForSupplier: boolean;
        };
      };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel atualizar o produto.");
        return;
      }

      setFeedback(`Gestao do produto ${group.parentSku} salva com sucesso.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar o produto.");
    } finally {
      setSavingSku(null);
    }
  }

  function suggestOrderWithPepperIa() {
    if (!selectedGroup || !pepperIaSummary) {
      return;
    }

    const suggestedQuantities = Object.fromEntries(
      selectedGroup.variants.map((variant) => [
        variant.sku,
        suggestPurchaseQuantity({
          currentStock: variant.quantity,
          sales1d: variant.sales["1d"],
          sales7d: variant.sales["7d"],
          sales15d: variant.sales15d,
          sales30d: variant.sales["1m"],
          criticalStockThreshold:
            toNullableNumber(selectedDraft?.variants[variant.sku]?.criticalStockThreshold ?? "") ??
            toNullableNumber(selectedDraft?.criticalStockThreshold ?? "") ??
            variant.effectiveCriticalStockThreshold,
          lowStockThreshold:
            toNullableNumber(selectedDraft?.variants[variant.sku]?.lowStockThreshold ?? "") ??
            toNullableNumber(selectedDraft?.lowStockThreshold ?? "") ??
            variant.effectiveLowStockThreshold
        }).suggestedQuantity
      ])
    );

    setOrderQuantities(suggestedQuantities);
    setOrderError(null);
    setOrderFeedbackTone(pepperIaSummary.tone);
    setOrderFeedback(pepperIaSummary.appliedMessage);
  }

  async function createOrderFromProduct() {
    if (!selectedGroup) {
      return;
    }

    setOrderFeedback(null);
    setOrderError(null);
    setCreatingOrder(true);

    const items = selectedGroup.variants
      .map((variant) => ({
        catalogVariantId: variant.id,
        sku: variant.sku,
        productName: `${selectedGroup.internalName} ${variant.colorLabel} ${variant.sizeLabel}`,
        color: variant.colorLabel,
        size: variant.sizeLabel,
        requestedQuantity: Number(orderQuantities[variant.sku] ?? 0),
        unitCost: variant.unitCost ?? 0
      }))
      .filter((item) => item.requestedQuantity > 0);

    if (!orderSupplierId || items.length === 0) {
      setOrderError("Selecione o fornecedor e informe pelo menos uma quantidade.");
      setCreatingOrder(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/supplier-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: orderSupplierId,
          productId: selectedGroup.id,
          productName: selectedDraft?.internalName ?? selectedGroup.internalName,
          productSku: selectedGroup.parentSku,
          imageUrl: selectedGroup.imageUrl,
          adminNote: orderNote,
          items
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        verification?: {
          storedInFoundation?: boolean;
          visibleForSupplier?: boolean;
        };
      };

      if (!response.ok) {
        setOrderError(payload.error ?? "Nao foi possivel criar o pedido agora.");
        return;
      }

      const successMessage =
        payload.verification?.storedInFoundation && payload.verification?.visibleForSupplier
          ? "Pedido criado a partir do produto, validado na fundacao e liberado para o fornecedor."
          : "Pedido criado com sucesso e enviado para o fluxo operacional.";
      window.sessionStorage.setItem(PRODUCT_ORDER_FLASH_KEY, successMessage);
      setOrderQuantities({});
      setOrderNote("");
      window.location.reload();
    } catch (requestError) {
      setOrderError(requestError instanceof Error ? requestError.message : "Nao foi possivel criar o pedido agora.");
    } finally {
      setCreatingOrder(false);
    }
  }

  function buildOrderSharePayload() {
    if (!selectedGroup) {
      return null;
    }

    const selectedSupplierName =
      selectableSuppliers.find((supplier) => supplier.id === orderSupplierId)?.name ??
      selectedGroup.suppliers[0]?.name ??
      "Fornecedor";

    const variants = selectedGroup.variants
      .map((variant) => ({
        sku: variant.sku,
        size: variant.sizeLabel,
        color: variant.colorLabel,
        currentStock: variant.quantity,
        requestedQuantity: Number(orderQuantities[variant.sku] ?? 0)
      }))
      .filter((variant) => variant.requestedQuantity > 0);

    if (variants.length === 0) {
      return null;
    }

    return {
      supplierId: orderSupplierId || null,
      supplierName: selectedSupplierName,
      productName: selectedDraft?.internalName ?? selectedGroup.internalName,
      productSku: selectedGroup.parentSku,
      imageUrl: selectedGroup.imageUrl,
      note: orderNote.trim(),
      variants
    };
  }

  async function requestOrderShareFile(): Promise<{ fileName: string; html: string } | null> {
    const payload = buildOrderSharePayload();

    if (!payload) {
      setOrderError("Informe pelo menos uma quantidade para gerar o arquivo do pedido.");
      return null;
    }

    const response = await fetch("/api/admin/purchase-order/html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = (await response.json()) as { error?: string; fileName?: string; html?: string };

    if (!response.ok || !body.fileName || !body.html) {
      throw new Error(body.error ?? "Nao foi possivel gerar o arquivo do pedido.");
    }

    return {
      fileName: body.fileName,
      html: body.html
    };
  }

  async function requestOrderWhatsAppLink(): Promise<{ shareUrl: string; text: string } | null> {
    const payload = buildOrderSharePayload();

    if (!payload) {
      setOrderError("Informe pelo menos uma quantidade para compartilhar o pedido.");
      return null;
    }

    const response = await fetch("/api/whatsapp-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        supplierId: payload.supplierId,
        productSku: payload.productSku,
        productName: payload.productName,
        imageUrl: payload.imageUrl,
        note: payload.note,
        items: payload.variants
      })
    });

    const body = (await response.json()) as { error?: string; shareUrl?: string; text?: string };

    if (!response.ok || !body.shareUrl || !body.text) {
      throw new Error(body.error ?? "Nao foi possivel gerar o link do WhatsApp.");
    }

    return {
      shareUrl: body.shareUrl,
      text: body.text
    };
  }

  async function downloadOrderDraft() {
    setOrderError(null);

    try {
      const file = await requestOrderShareFile();
      if (!file) {
        return;
      }

      downloadHtmlFile(file.fileName, file.html);
      setOrderFeedbackTone("success");
      setOrderFeedback("Arquivo do pedido gerado para download.");
    } catch (requestError) {
      setOrderError(requestError instanceof Error ? requestError.message : "Nao foi possivel gerar o arquivo do pedido.");
    }
  }

  async function shareOrderDraftOnWhatsApp() {
    setOrderError(null);

    try {
      const link = await requestOrderWhatsAppLink();
      if (!link) {
        return;
      }

      openWhatsAppShare(link.text);
      setOrderFeedbackTone("success");
      setOrderFeedback("Link do WhatsApp criado e pronto para envio.");
    } catch (requestError) {
      setOrderError(requestError instanceof Error ? requestError.message : "Nao foi possivel gerar o link do WhatsApp.");
    }
  }

  async function reconcileSelectedProductStock() {
    if (!selectedGroup) {
      return;
    }

    setReconcileFeedback(null);
    setReconcileError(null);
    setReconcilingSku(selectedGroup.parentSku);

    try {
      const response = await fetch("/api/admin/products/reconcile-stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parentSku: selectedGroup.parentSku
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        summary?: {
          reconciled: number;
          failed: number;
          authoritativeAccountKey: string;
        };
      };

      if (!response.ok || !payload.summary) {
        setReconcileError(payload.error ?? "Nao foi possivel reconciliar as filhas deste produto agora.");
        return;
      }

      setReconcileFeedback(
        `${payload.summary.reconciled} filhas reconciliadas pela ${payload.summary.authoritativeAccountKey}. ${
          payload.summary.failed > 0 ? `${payload.summary.failed} falharam.` : "Tudo certo neste lote."
        }`
      );
      window.location.reload();
    } catch (requestError) {
      setReconcileError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel reconciliar as filhas deste produto agora."
      );
    } finally {
      setReconcilingSku(null);
    }
  }

  function renderVariantInsightCard(item: VariantRow, contextColorLabel?: string | null) {
    const coverageDays = safeCoverageDays(item.quantity ?? 0, item.sales["1m"]);
    const demandSignal = describeVariantDemandSignal({
      salesToday: item.sales["1d"],
      sales7d: item.sales["7d"],
      sales15d: item.sales15d,
      sales30d: item.sales["1m"],
      maxSales30d: selectedVariantSalesMax30d,
      averageSales30d: selectedVariantSalesAverage30d
    });

    return (
      <div key={item.sku} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{item.quantity ?? "-"}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-400">{item.sku}</p>
            <p className="text-[11px] text-slate-500">{contextColorLabel ?? item.colorLabel}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", bandBadgeTone(item.band))}>
            {item.band === "critical" ? "Critico" : item.band === "low" ? "Baixo" : item.band === "ok" ? "Saudavel" : "Sem leitura"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <InfoPill label="Hoje" value={String(item.sales["1d"])} />
          <InfoPill label="7d" value={String(item.sales["7d"])} />
          <InfoPill label="15d" value={String(item.sales15d)} />
          <InfoPill label="30d" value={String(item.sales["1m"])} />
          <InfoPill label="Saldo" value={item.quantity === null ? "-" : String(item.quantity)} />
          <InfoPill label="Reservado" value={String(item.reservedStock ?? 0)} />
          <InfoPill label="Cobertura" value={coverageDays === null ? "Sem base" : `${coverageDays}d`} />
          <InfoPill label="Sinal" value={demandSignal.label} tone={demandSignal.tone} />
        </div>

        {selectedLinkedSupplier ? (
          <div className="mt-3 rounded-xl border border-[#f1dccf] bg-white px-3 py-2 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-slate-700">{selectedLinkedSupplier.name}</span>
              <span>Critica {selectedLinkedSupplier.criticalStockThreshold ?? "-"}</span>
              <span>Baixo {selectedLinkedSupplier.lowStockThreshold ?? "-"}</span>
              <span>
                Preco {selectedLinkedSupplier.supplierSalePrice === null || selectedLinkedSupplier.supplierSalePrice === undefined ? "-" : formatCurrency(selectedLinkedSupplier.supplierSalePrice)}
              </span>
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">{demandSignal.description}</span>
        </div>

        <div className="mt-3 grid gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Pedido</span>
            <input
              type="number"
              min={0}
              value={orderQuantities[item.sku] ?? ""}
              onChange={(event) =>
                setOrderQuantities((current) => ({
                  ...current,
                  [item.sku]: Number(event.target.value || 0)
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Qtd"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d27a4f]">Gestor geral de produto e estoque</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Produtos, estoque critico e atalhos operacionais</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Cada card resume saldo, giro, prioridade de compra e acesso rapido ao modal de gestao com grade cor x tamanho.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold",
                tinyConfigured
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              )}
            >
              {tinyConfigured ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {tinyConfigured ? "Cadastro sob demanda pelo Tiny" : "Tiny ainda nao configurado"}
            </div>

            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/40"
            >
              <DatabaseZap className="h-4 w-4" />
                Buscar ou importar SKU
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Produtos monitorados" value={dashboard.productCount} tone="soft" />
          <MetricCard label="Criticos ou baixos" value={dashboard.atRiskCount} tone="critical" />
          <MetricCard label="Vendas 7d" value={dashboard.totalSales7d} tone="soft" />
          <MetricCard label="Vendas 30d" value={dashboard.totalSales30d} tone="low" />
          <MetricCard label="Pedidos em andamento" value={dashboard.orderCardsInProgress} tone="soft" />
          <MetricCard label="Pendencias de compra" value={dashboard.replenishmentPendingCount} tone="low" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
            Produtos desatualizados: {dashboard.staleCount}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
            Vendas hoje: {dashboard.totalSalesToday}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
            Prontos para financeiro: {dashboard.readyForFinancialCount}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
            Em revisao financeira: {dashboard.financialReviewCount}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
            Pagamentos pendentes: {dashboard.paymentPendingCount}
          </span>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-panel backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Filtrar por fornecedor</span>
            <select
              value={selectedSupplierId}
              onChange={(event) => setSelectedSupplierId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            >
              <option value="all">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Buscar por SKU pai, SKU filha ou nome</span>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={skuQuery}
                onChange={(event) => setSkuQuery(event.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="Ex.: 01-2504 ou Conjunto Fitness Aura"
              />
            </div>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSelectedSupplierId("all");
                setSkuQuery("");
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </button>
          </div>
        </div>
      </section>

      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {filteredGroups.length > 0 ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredGroups.map((group) => (
            <button
              key={group.parentSku}
              type="button"
              onClick={() => setSelectedSku(group.parentSku)}
              className={cn(
                "rounded-[2rem] border p-5 text-left shadow-soft transition hover:-translate-y-0.5",
                bandTone(group.band)
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.25em] text-slate-400">{group.parentSku}</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">{shortenProductTitle(group.internalName)}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {group.variantCount} variacoes • multiempresa {group.totalStock} • reservado {group.totalReservedStock ?? 0}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                    <span className="rounded-full bg-white/80 px-3 py-1">Atualizado {group.updatedAt}</span>
                    {group.suppliers.length > 0 ? (
                      <span className="rounded-full bg-white/80 px-3 py-1">
                        {group.suppliers.map((supplier) => supplier.name).join(" • ")}
                      </span>
                    ) : null}
                  </div>
                </div>

                <ProductReferenceThumbnail
                  imageUrl={group.imageUrl}
                  alt={group.internalName}
                  sku={group.parentSku}
                  onClick={() => setPreviewImage({ src: group.imageUrl, alt: group.internalName })}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", bandBadgeTone(group.band))}>
                  {group.bandLabel}
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">{group.movementBadge}</span>
                {group.staleCount > 0 ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-amber-700">
                    {group.staleCount} desatualizadas
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                <InfoBox label="Vendas 1D" value={String(group.sales["1d"])} />
                <InfoBox label="Vendas 7D" value={String(group.sales["7d"])} />
                <InfoBox label="Vendas 30D" value={String(group.sales["1m"])} />
                <InfoBox
                  label="Cobertura"
                  value={group.coverageDays === null ? "Sem base" : `${group.coverageDays} dias`}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {group.topColorLabel ? (
                  <span className="rounded-full bg-white/80 px-3 py-2 font-semibold text-slate-700">
                    Cor lider: {group.topColorLabel}
                  </span>
                ) : null}
                {group.topSizeLabel ? (
                  <span className="rounded-full bg-white/80 px-3 py-2 font-semibold text-slate-700">
                    Tamanho lider: {group.topSizeLabel}
                  </span>
                ) : null}
                <span className="rounded-full bg-white/80 px-3 py-2 font-semibold text-slate-700">
                  Custo em estoque: {formatCurrency(group.totalEstimatedCost)}
                </span>
              </div>

              <div className="mt-4">
                <ProductOperationalStrip
                  compact
                  replenishmentCard={group.replenishmentCard}
                  activeOrder={group.activeOrder}
                  relatedOrderCount={group.relatedOrderCount}
                />
              </div>

              <div className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                <PackagePlus className="h-4 w-4" />
                Abrir gestor do produto
              </div>
            </button>
          ))}
        </section>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
          Nenhum produto encontrado com os filtros atuais.
        </div>
      )}

      {selectedGroup && selectedDraft ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onClick={() => setSelectedSku(null)}>
          <div className="max-h-[100vh] w-full overflow-y-auto rounded-none border border-white/60 bg-white/95 p-4 shadow-panel sm:max-h-[94vh] sm:max-w-[min(97vw,112rem)] sm:rounded-[2rem] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <ProductReferenceThumbnail
                  imageUrl={selectedGroup.imageUrl}
                  alt={selectedGroup.internalName}
                  sku={selectedGroup.parentSku}
                  size="hero"
                  onClick={() => setPreviewImage({ src: selectedGroup.imageUrl, alt: selectedGroup.internalName })}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Gestor de produto e estoque</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{selectedGroup.internalName}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedGroup.parentSku} • {selectedGroup.variantCount} variacoes • {selectedGroup.bandLabel}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">{selectedReadableVariantCount}/{selectedGroup.variantCount} com leitura</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">{selectedGroup.staleCount} desatualizadas</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">Atualizado {selectedGroup.updatedAt}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSku(null)}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
              <InfoMetric label="Saldo atual" value={String(selectedGroup.totalStock)} tone="bg-slate-50 text-slate-700" />
              <InfoMetric label="Reservado" value={String(selectedGroup.totalReservedStock ?? 0)} tone="bg-slate-50 text-slate-700" />
              <InfoMetric label="Vendas hoje" value={String(selectedGroup.sales["1d"])} tone="bg-slate-50 text-slate-700" />
              <InfoMetric label="Vendas 7D" value={String(selectedGroup.sales["7d"])} tone="bg-slate-50 text-slate-700" />
              <InfoMetric label="Vendas 15D" value={String(selectedSales15d)} tone="bg-slate-50 text-slate-700" />
              <InfoMetric label="Vendas 30D" value={String(selectedGroup.sales["1m"])} tone="bg-slate-50 text-slate-700" />
              <InfoMetric
                label="Cobertura"
                value={selectedGroup.coverageDays === null ? "Sem base" : `${selectedGroup.coverageDays} dias`}
                tone="bg-slate-50 text-slate-700"
              />
              <InfoMetric label="Pedidos ligados" value={String(selectedGroup.relatedOrderCount)} tone="bg-slate-50 text-slate-700" />
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <section className="rounded-[1.7rem] border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Fornecedores vinculados</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Clique para definir o contexto de compra. Critica e preco aparecem aqui so como leitura visual.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={reconcilingSku !== null}
                    onClick={() => void reconcileSelectedProductStock()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#f2d6c5] bg-white px-4 py-3 text-sm font-semibold text-[#a65228] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {reconcilingSku === selectedGroup.parentSku ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {reconcilingSku === selectedGroup.parentSku ? "Chamando filhas..." : "Atualizar filhas por lotes"}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {selectedGroup.suppliers.length > 0 ? (
                    selectedGroup.suppliers.map((supplier) => {
                      const isActiveSupplier = supplier.id === selectedLinkedSupplier?.id;

                      return (
                        <button
                          key={`${selectedGroup.parentSku}-${supplier.id}`}
                          type="button"
                          onClick={() => setOrderSupplierId(supplier.id)}
                          className={cn(
                            "min-w-[13rem] rounded-[1.4rem] border px-4 py-3 text-left transition",
                            isActiveSupplier
                              ? "border-[#f0c9b1] bg-[#fff8f1] shadow-soft"
                              : "border-slate-200 bg-white hover:border-[#f0c9b1]"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">{supplier.name}</p>
                            {isActiveSupplier ? (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                Pedido ativo
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                            <InfoPill
                              label="Preco"
                              value={supplier.supplierSalePrice === null || supplier.supplierSalePrice === undefined ? "-" : formatCurrency(supplier.supplierSalePrice)}
                              compact
                            />
                            <InfoPill
                              label="Critica"
                              value={supplier.criticalStockThreshold === null || supplier.criticalStockThreshold === undefined ? "-" : String(supplier.criticalStockThreshold)}
                              compact
                            />
                            <InfoPill
                              label="Baixo"
                              value={supplier.lowStockThreshold === null || supplier.lowStockThreshold === undefined ? "-" : String(supplier.lowStockThreshold)}
                              compact
                            />
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <span className="rounded-full border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                      Nenhum fornecedor vinculado
                    </span>
                  )}
                </div>

                {reconcileFeedback ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {reconcileFeedback}
                  </div>
                ) : null}
                {reconcileError ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {reconcileError}
                  </div>
                ) : null}
              </section>

              <section className="rounded-[1.7rem] border border-[#f2d8ca] bg-[#fffaf7] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Contas Tiny deste produto</p>
                    <p className="mt-1 text-sm text-slate-500">Cinza = sem sinal na fundacao. Colorido = anuncio vivo por essa conta.</p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", bandBadgeTone(selectedGroup.band))}>
                    {selectedGroup.bandLabel}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {(selectedGroup.accountSummaries && selectedGroup.accountSummaries.length > 0
                    ? selectedGroup.accountSummaries
                    : DEFAULT_ACCOUNT_SUMMARIES
                  ).map((account) => (
                    <div
                      key={`${selectedGroup.parentSku}-${account.accountKey}`}
                      className={cn("rounded-[1.4rem] border px-3 py-3 text-center", accountPresenceTone(account))}
                    >
                      <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.2rem] bg-white/90 p-2 shadow-inner">
                        <img
                          src={account.logoUrl}
                          alt={account.label}
                          className={cn("h-full w-full object-contain", account.hasSignal ? "" : "grayscale opacity-50")}
                        />
                      </div>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em]">{account.label}</p>
                      <p className="mt-1 text-sm font-semibold">{account.salesTotal} vendas</p>
                      <p className="mt-1 text-[11px] opacity-75">
                        Hoje {account.salesToday} • 7d {account.sales7d}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.7fr))]">
              {selectedSalesRhythm ? (
                <div className={cn("rounded-[1.5rem] border px-4 py-4 text-sm", selectedSalesRhythm.tone)}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">Pepper IA</p>
                  <p className="mt-2 text-lg font-semibold">{selectedSalesRhythm.title}</p>
                  <p className="mt-2 leading-6">{selectedSalesRhythm.description}</p>
                </div>
              ) : null}
              <InfoBox label="Cor que mais sai" value={selectedGroup.topColorLabel ?? "Sem base"} />
              <InfoBox label="Tamanho que mais sai" value={selectedGroup.topSizeLabel ?? "Sem base"} />
              <InfoBox label="Momento do produto" value={selectedGroup.movementBadge} />
            </div>

            <div className="mt-5 grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[20rem_minmax(0,1fr)]">
              <div className="space-y-5">
                <section className="rounded-[1.7rem] border border-slate-200 bg-slate-50/80 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Card no portal</p>
                      <p className="mt-1 text-sm text-slate-500">A fundacao continua dona do catalogo. Aqui voce so controla a visibilidade do card.</p>
                    </div>
                    <button
                      type="button"
                      disabled={savingSku !== null}
                      onClick={() => void saveGroup(selectedGroup)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {savingSku === selectedGroup.parentSku ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {savingSku === selectedGroup.parentSku ? "Salvando..." : "Salvar ajustes"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">Nome vindo da fundacao</span>
                      <input
                        value={selectedDraft.internalName}
                        readOnly
                        disabled
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"
                      />
                    </label>

                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Card visivel no portal</p>
                        <p className="text-xs text-slate-500">Ocultar remove do fornecedor sem apagar o produto canonico.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateDraft(selectedGroup.parentSku, { active: !selectedDraft.active })}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-semibold transition",
                          selectedDraft.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        )}
                      >
                          {selectedDraft.active ? "Visivel" : "Oculto"}
                      </button>
                    </div>

                    <InfoBox label="Fornecedores" value={selectedGroup.suppliers.length > 0 ? `${selectedGroup.suppliers.length} vinculados` : "Sem vinculo"} />
                  </div>
                </section>

                <section className="rounded-[1.7rem] border border-[#f2d7c7] bg-[#fff8f4] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Pedido direto do produto</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Monte a compra a partir da grade e use a Pepper IA para equilibrar o ritmo de 7, 15 e 30 dias.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={suggestOrderWithPepperIa}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#a94c25] sm:w-auto"
                    >
                      <Sparkles className="h-4 w-4" />
                      Pepper AI
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div className="rounded-2xl border border-[#f1dccf] bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Fornecedor ativo do pedido</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {selectedLinkedSupplier?.name ?? "Nenhum fornecedor vinculado"}
                      </p>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao do admin</span>
                      <textarea
                        value={orderNote}
                        onChange={(event) => setOrderNote(event.target.value)}
                        className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                        placeholder="Ex.: priorizar grade da vitrine e confirmar disponibilidade."
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoBox label="Variacoes com qtd" value={String(orderVariantCount)} />
                      <InfoBox label="Valor estimado" value={formatCurrency(estimatedOrderTotal)} />
                    </div>

                    {pepperIaSummary ? (
                      <div
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm",
                          pepperIaSummary.tone === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                          {pepperIaSummary.appliedMessage}
                        </div>
                      ) : null}

                    {orderFeedback ? (
                      <div
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm",
                          orderFeedbackTone === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {orderFeedback}
                      </div>
                    ) : null}
                    {orderError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{orderError}</div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOrderQuantities({});
                          setOrderFeedback(null);
                          setOrderFeedbackTone("success");
                          setOrderError(null);
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                      >
                        Limpar pedido
                      </button>
                      <button
                        type="button"
                        disabled={creatingOrder}
                        onClick={() => void createOrderFromProduct()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {creatingOrder ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                        {creatingOrder ? "Criando..." : "Criar pedido"}
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => void shareOrderDraftOnWhatsApp()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadOrderDraft()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                      >
                        <Download className="h-4 w-4" />
                        Baixar arquivo
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <section className="rounded-[1.7rem] border border-[#f2d8ca] bg-[#fffaf7] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">Leitura por variacao</h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Hoje, 7d, 15d, 30d, saldo, reservado, cobertura e sinal de giro para apoiar compra inteligente.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    Contexto do pedido: {selectedLinkedSupplier?.name ?? "Sem fornecedor ativo"}
                  </span>
                </div>

                <div className="mt-5 space-y-4 xl:hidden">
                  {matrix.map((row) => (
                    <div key={`${row.color}-insight-mobile`} className="rounded-[1.4rem] border border-[#f4d7c7] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="text-base font-semibold text-slate-900">{row.color}</h5>
                        <span className="rounded-full bg-[#fff3ec] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a94c25]">
                          {row.items.filter(Boolean).length} tamanhos
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {row.items.map((item) => (item ? renderVariantInsightCard(item, row.color) : null))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 hidden xl:block">
                  {isSingleSizeGroup ? (
                    <div className="space-y-4 rounded-[1.4rem] border border-[#f4d7c7] bg-white p-4">
                      {matrix.map((row) => (
                        <section key={`${row.color}-insight`} className="rounded-[1.4rem] border border-[#f8e4d9] bg-[#fffaf6] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h5 className="text-base font-semibold text-slate-900">{row.color}</h5>
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a94c25]">
                              {sizes[0] ?? "Unico"}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-5 gap-3">
                            {row.items.filter(Boolean).map((item) => renderVariantInsightCard(item!, row.color))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[1.4rem] border border-[#f4d7c7]">
                      <div
                        className="grid bg-[#fff3ec] text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                        style={{ gridTemplateColumns: `minmax(140px,0.8fr) repeat(${sizes.length}, minmax(0,1fr))` }}
                      >
                        <div className="px-4 py-3">Cor</div>
                        {sizes.map((size) => (
                          <div key={size} className="px-4 py-3 text-center">
                            {size}
                          </div>
                        ))}
                      </div>

                      {matrix.map((row) => (
                        <div
                          key={`${row.color}-insight-grid`}
                          className="grid border-t border-[#f8e4d9] bg-white"
                          style={{ gridTemplateColumns: `minmax(140px,0.8fr) repeat(${sizes.length}, minmax(0,1fr))` }}
                        >
                          <div className="px-4 py-4 text-sm font-semibold text-slate-900">{row.color}</div>
                          {row.items.map((item, index) =>
                            item ? (
                              <div key={item.sku} className="px-3 py-3">
                                {renderVariantInsightCard(item, row.color)}
                              </div>
                            ) : (
                              <div key={`${row.color}-${sizes[index]}-empty`} className="px-3 py-3">
                                <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-300">
                                  -
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="hidden rounded-[1.7rem] border border-[#f2d8ca] bg-[#fffaf7] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">Leitura por variacao</h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Hoje, 7d, 15d, 30d, saldo, reservado, cobertura e sinal de giro para apoiar compra inteligente.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    Contexto do pedido: {selectedLinkedSupplier?.name ?? "Sem fornecedor ativo"}
                  </span>
                </div>

                <div className="mt-5 space-y-4 xl:hidden">
                  {matrix.map((row) => (
                    <div key={`${row.color}-mobile`} className="rounded-[1.4rem] border border-[#f4d7c7] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="text-base font-semibold text-slate-900">{row.color}</h5>
                        <span className="rounded-full bg-[#fff3ec] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a94c25]">
                          {row.items.filter(Boolean).length} tamanhos
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {row.items.map((item, index) => {
                          if (!item) {
                            return null;
                          }

                          const variantDraft = selectedDraft.variants[item.sku];

                          return (
                            <div key={`${item.sku}-mobile`} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{sizes[index]}</p>
                                  <p className="mt-2 text-xl font-semibold text-slate-900">{item.quantity ?? "-"}</p>
                                  <p className="mt-1 text-[11px] font-medium text-slate-400">{item.sku}</p>
                                  <p className="text-[11px] text-slate-500">{row.color}</p>
                                </div>
                                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", bandBadgeTone(item.band))}>
                                  {item.band === "critical" ? "Critico" : item.band === "low" ? "Baixo" : item.band === "ok" ? "Saudavel" : "Sem leitura"}
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                                <div className="rounded-xl bg-white px-3 py-2">Vendas {activePeriod.toUpperCase()}: {item.sales[activePeriod]}</div>
                                <div className="rounded-xl bg-white px-3 py-2">Custo: {formatCurrency(item.unitCost ?? 0)}</div>
                                <div className="rounded-xl bg-white px-3 py-2">Reservado: {item.reservedStock ?? 0}</div>
                                <div className="rounded-xl bg-white px-3 py-2">Disponível: {item.quantity ?? "-"}</div>
                              </div>

                              <div className="mt-3 grid gap-2">
                                <label className="block">
                                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Pedido</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={orderQuantities[item.sku] ?? ""}
                                    onChange={(event) =>
                                      setOrderQuantities((current) => ({
                                        ...current,
                                        [item.sku]: Number(event.target.value || 0)
                                      }))
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                                    placeholder="Qtd"
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 hidden xl:block">
                  {isSingleSizeGroup ? (
                    <div className="space-y-4 rounded-[1.4rem] border border-[#f4d7c7] bg-white p-4">
                      {matrix.map((row) => (
                        <section key={row.color} className="rounded-[1.4rem] border border-[#f8e4d9] bg-[#fffaf6] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h5 className="text-base font-semibold text-slate-900">{row.color}</h5>
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a94c25]">
                              {sizes[0] ?? "Unico"}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-5 gap-3">
                            {row.items.filter(Boolean).map((item) => {
                              const safeItem = item!;
                              const variantDraft = selectedDraft.variants[safeItem.sku];

                              return (
                                <div key={safeItem.sku} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-lg font-semibold text-slate-900">{safeItem.quantity ?? "-"}</p>
                                      <p className="mt-1 text-[11px] font-medium text-slate-400">{safeItem.sku}</p>
                                      <p className="text-[11px] text-slate-500">{row.color}</p>
                                    </div>
                                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", bandBadgeTone(safeItem.band))}>
                                      {safeItem.band === "critical" ? "Critico" : safeItem.band === "low" ? "Baixo" : safeItem.band === "ok" ? "Saudavel" : "Sem leitura"}
                                    </span>
                                  </div>
                                  <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                    <div className="rounded-xl bg-white px-3 py-2">Vendas {activePeriod.toUpperCase()}: {safeItem.sales[activePeriod]}</div>
                                    <div className="rounded-xl bg-white px-3 py-2">Custo base: {formatCurrency(safeItem.unitCost ?? 0)}</div>
                                    <div className="rounded-xl bg-white px-3 py-2">Reservado: {safeItem.reservedStock ?? 0}</div>
                                    <div className="rounded-xl bg-white px-3 py-2">Disponível: {safeItem.quantity ?? "-"}</div>
                                  </div>
                                  <div className="mt-3 grid gap-2">
                                    <label className="block">
                                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Pedido</span>
                                      <input
                                        type="number"
                                        min={0}
                                        value={orderQuantities[safeItem.sku] ?? ""}
                                        onChange={(event) =>
                                          setOrderQuantities((current) => ({
                                            ...current,
                                            [safeItem.sku]: Number(event.target.value || 0)
                                          }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                                        placeholder="Qtd"
                                      />
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[1.4rem] border border-[#f4d7c7]">
                      <div
                        className="grid bg-[#fff3ec] text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                        style={{ gridTemplateColumns: `minmax(140px,0.8fr) repeat(${sizes.length}, minmax(0,1fr))` }}
                      >
                        <div className="px-4 py-3">Cor</div>
                        {sizes.map((size) => (
                          <div key={size} className="px-4 py-3 text-center">
                            {size}
                          </div>
                        ))}
                      </div>

                      {matrix.map((row) => (
                        <div
                          key={row.color}
                          className="grid border-t border-[#f8e4d9] bg-white"
                          style={{ gridTemplateColumns: `minmax(140px,0.8fr) repeat(${sizes.length}, minmax(0,1fr))` }}
                        >
                          <div className="px-4 py-4 text-sm font-semibold text-slate-900">{row.color}</div>
                          {row.items.map((item, index) => {
                            if (!item) {
                              return (
                                <div key={`${row.color}-${sizes[index]}`} className="px-3 py-3">
                                  <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-300">
                                    -
                                  </div>
                                </div>
                              );
                            }

                            const variantDraft = selectedDraft.variants[item.sku];

                            return (
                              <div key={item.sku} className="px-3 py-3">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-lg font-semibold text-slate-900">{item.quantity ?? "-"}</p>
                                      <p className="mt-1 text-[11px] font-medium text-slate-400">{item.sku}</p>
                                      <p className="text-[11px] text-slate-500">{row.color}</p>
                                    </div>
                                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", bandBadgeTone(item.band))}>
                                      {item.band === "critical" ? "Critico" : item.band === "low" ? "Baixo" : item.band === "ok" ? "Saudavel" : "Sem leitura"}
                                    </span>
                                  </div>

                                  <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                    <div className="rounded-xl bg-white px-3 py-2">Vendas {activePeriod.toUpperCase()}: {item.sales[activePeriod]}</div>
                                    <div className="rounded-xl bg-white px-3 py-2">
                                      Custo base: {formatCurrency(item.unitCost ?? 0)}
                                    </div>
                                    <div className="rounded-xl bg-white px-3 py-2">Reservado: {item.reservedStock ?? 0}</div>
                                    <div className="rounded-xl bg-white px-3 py-2">Disponível: {item.quantity ?? "-"}</div>
                                  </div>

                                    <div className="mt-3 grid gap-2">
                                      <label className="block">
                                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Pedido</span>
                                        <input
                                        type="number"
                                        min={0}
                                        value={orderQuantities[item.sku] ?? ""}
                                        onChange={(event) =>
                                          setOrderQuantities((current) => ({
                                            ...current,
                                            [item.sku]: Number(event.target.value || 0)
                                          }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                                        placeholder="Qtd"
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <button type="button" className="absolute inset-0" onClick={() => setPreviewImage(null)} aria-label="Fechar imagem ampliada" />
          <div className="relative z-10 max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/20 bg-white p-3 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 text-slate-500"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-h-[85vh] w-full rounded-[1.6rem] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      ) : null}

      {importModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onClick={() => setImportModalOpen(false)}>
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-[2rem] border border-white/60 bg-white/95 p-4 shadow-panel sm:max-h-[92vh] sm:max-w-6xl sm:rounded-[2rem] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Importacao integrada</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">Importar produto do Tiny dentro de Produtos</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Revise o SKU pai, confirme a grade e vincule o cadastro sem sair do gestor operacional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AdminImportConsole suppliers={suppliers} tinyConfigured={tinyConfigured} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "soft" | "critical" | "low" }) {
  const tones = {
    soft: "border-white bg-white/80",
    critical: "border-rose-100 bg-rose-50",
    low: "border-amber-100 bg-amber-50"
  };

  return (
    <div className={cn("flex min-h-[6.25rem] flex-col justify-between rounded-[1.6rem] border px-4 py-3 shadow-soft", tones[tone])}>
      <p className="min-h-[2rem] text-xs font-medium leading-tight text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/80 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InfoPill({
  label,
  value,
  tone,
  compact = false
}: {
  label: string;
  value: string;
  tone?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-xl bg-white px-3 py-2", tone)}>
      <p className={cn("font-semibold uppercase tracking-[0.12em] text-slate-400", compact ? "text-[10px]" : "text-[11px]")}>
        {label}
      </p>
      <p className={cn("mt-1 font-semibold text-slate-900", compact ? "text-xs" : "text-sm")}>{value}</p>
    </div>
  );
}

function InfoMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={cn("rounded-[1.3rem] px-4 py-3 text-sm", tone)}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
