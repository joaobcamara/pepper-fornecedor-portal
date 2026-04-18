import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  pickPreferredCatalogImageUrl,
  PORTAL_BRAND_FALLBACK_IMAGE
} from "@/lib/catalog-images";
import { cacheRemoteImage } from "@/lib/local-files";
import { prisma } from "@/lib/prisma";
import { getParentSku, normalizeSku } from "@/lib/sku";

const CACHE_CONTROL_HEADER = "public, max-age=900, stale-while-revalidate=86400";

function inferContentTypeFromPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

async function readLocalPublicImage(relativeUrl: string) {
  const absolutePath = path.join(process.cwd(), "public", relativeUrl.replace(/^\//, ""));
  const buffer = await readFile(absolutePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": inferContentTypeFromPath(absolutePath),
      "Cache-Control": CACHE_CONTROL_HEADER
    }
  });
}

async function resolveCatalogProductImage(parentSku: string) {
  const catalogProduct = await prisma.catalogProduct.findUnique({
    where: {
      skuParent: parentSku
    },
    select: {
      id: true,
      skuParent: true,
      mainImageUrl: true,
      sourceProductId: true,
      images: {
        where: {
          catalogVariantId: null
        },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          url: true,
          isPrimary: true
        }
      }
    }
  });

  if (!catalogProduct) {
    return null;
  }

  const sourceProduct = catalogProduct.sourceProductId
    ? await prisma.product.findUnique({
        where: {
          id: catalogProduct.sourceProductId
        },
        select: {
          imageUrl: true
        }
      })
    : null;

  return {
    catalogProduct,
    imageUrl:
      pickPreferredCatalogImageUrl([
        catalogProduct.mainImageUrl,
        sourceProduct?.imageUrl ?? null,
        catalogProduct.images.find((image) => image.isPrimary)?.url ?? null,
        catalogProduct.images[0]?.url ?? null
      ]) ?? PORTAL_BRAND_FALLBACK_IMAGE
  };
}

async function maybeCacheCatalogProductImage(params: {
  catalogProductId: string;
  parentSku: string;
  imageUrl: string;
}) {
  if (!params.imageUrl || params.imageUrl.startsWith("/")) {
    return params.imageUrl;
  }

  const cachedUrl = await cacheRemoteImage({
    url: params.imageUrl,
    folder: "uploads/foundation/catalog",
    prefix: `${params.parentSku}-proxy`
  });

  if (!cachedUrl || cachedUrl === params.imageUrl) {
    return params.imageUrl;
  }

  await prisma.catalogProduct.update({
    where: {
      id: params.catalogProductId
    },
    data: {
      mainImageUrl: cachedUrl
    }
  });

  await prisma.catalogImage.updateMany({
    where: {
      catalogProductId: params.catalogProductId,
      catalogVariantId: null,
      url: params.imageUrl
    },
    data: {
      url: cachedUrl
    }
  });

  return cachedUrl;
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      sku: string;
    }>;
  }
) {
  const resolvedParams = await context.params;
  const normalizedSku = normalizeSku(resolvedParams.sku);
  const parentSku = getParentSku(normalizedSku) ?? normalizedSku;

  const resolved = parentSku ? await resolveCatalogProductImage(parentSku) : null;
  const resolvedUrl = resolved?.imageUrl ?? PORTAL_BRAND_FALLBACK_IMAGE;

  const finalUrl =
    resolved && parentSku
      ? await maybeCacheCatalogProductImage({
          catalogProductId: resolved.catalogProduct.id,
          parentSku,
          imageUrl: resolvedUrl
        })
      : resolvedUrl;

  if (finalUrl.startsWith("/")) {
    return readLocalPublicImage(finalUrl);
  }

  const upstream = await fetch(finalUrl, {
    cache: "no-store",
    redirect: "follow"
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    return readLocalPublicImage(PORTAL_BRAND_FALLBACK_IMAGE);
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
      "Cache-Control": CACHE_CONTROL_HEADER
    }
  });
}
