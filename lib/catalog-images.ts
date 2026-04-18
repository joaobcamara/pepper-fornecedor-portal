import { getParentSku, normalizeSku } from "@/lib/sku";

export const PORTAL_BRAND_FALLBACK_IMAGE = "/brand/pepper-logo.png";

export function pickPreferredCatalogImageUrl(candidates: Array<string | null | undefined>) {
  const normalized = candidates
    .map((candidate) => candidate?.trim() ?? null)
    .filter((candidate): candidate is string => Boolean(candidate));

  return (
    normalized.find((candidate) => candidate !== PORTAL_BRAND_FALLBACK_IMAGE) ??
    normalized[0] ??
    null
  );
}

export function buildCatalogProductImageProxyUrl(inputSku: string, fallbackUrl?: string | null) {
  const normalizedSku = normalizeSku(inputSku);
  const parentSku = getParentSku(normalizedSku) ?? normalizedSku;

  if (!parentSku) {
    return fallbackUrl ?? PORTAL_BRAND_FALLBACK_IMAGE;
  }

  return `/api/catalog/products/${encodeURIComponent(parentSku)}/image`;
}

export function resolvePortalCatalogImageUrl(params: {
  sku: string;
  imageUrl?: string | null;
  fallbackUrl?: string | null;
}) {
  const imageUrl = params.imageUrl?.trim() ?? "";

  if (!imageUrl) {
    return params.fallbackUrl ?? PORTAL_BRAND_FALLBACK_IMAGE;
  }

  if (imageUrl.startsWith("/")) {
    return imageUrl;
  }

  return buildCatalogProductImageProxyUrl(params.sku, params.fallbackUrl);
}
