import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const PUBLIC_DIR = path.join(process.cwd(), "public");

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function getSupabaseStorageConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "portal-assets";

  if (url && serviceRoleKey) {
    return {
      url: url.replace(/\/+$/, ""),
      serviceRoleKey,
      bucket
    };
  }

  return null;
}

function buildObjectPath(params: {
  folder: string;
  fileName: string;
}) {
  const relativeFolder = params.folder.replace(/^\/+/, "");
  return `${relativeFolder}/${params.fileName}`.replace(/\\/g, "/");
}

function getFileExtensionFromContentType(contentType: string | null) {
  switch (contentType?.split(";")[0].trim().toLowerCase()) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    case "image/avif":
      return ".avif";
    default:
      return "";
  }
}

function buildManagedFileName(params: {
  originalName?: string | null;
  prefix?: string;
  contentType?: string | null;
}) {
  const prefix = params.prefix ? `${sanitizeSegment(params.prefix)}-` : "";
  const originalExtension = params.originalName ? path.extname(params.originalName) : "";
  const extension = originalExtension || getFileExtensionFromContentType(params.contentType ?? null);
  return `${prefix}${randomUUID()}${extension}`;
}

async function uploadBufferToSupabase(params: {
  buffer: Buffer;
  contentType: string;
  folder: string;
  fileName: string;
}) {
  const storage = getSupabaseStorageConfig();

  if (!storage) {
    throw new Error("Supabase Storage nao configurado.");
  }

  const objectPath = buildObjectPath({
    folder: params.folder,
    fileName: params.fileName
  });

  const response = await fetch(`${storage.url}/storage/v1/object/${storage.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${storage.serviceRoleKey}`,
      apikey: storage.serviceRoleKey,
      "Content-Type": params.contentType,
      "x-upsert": "false"
    },
    body: new Uint8Array(params.buffer)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Falha no upload para o Supabase Storage: ${response.status} ${errorBody}`.trim());
  }

  return `${storage.url}/storage/v1/object/public/${storage.bucket}/${objectPath}`;
}

async function writeBufferLocally(params: {
  buffer: Buffer;
  folder: string;
  fileName: string;
}) {
  const relativeFolder = params.folder.replace(/^\/+/, "");
  const absoluteFolder = path.join(PUBLIC_DIR, relativeFolder);

  await mkdir(absoluteFolder, { recursive: true });
  await writeFile(path.join(absoluteFolder, params.fileName), params.buffer);

  return `/${relativeFolder}/${params.fileName}`.replace(/\\/g, "/");
}

async function saveUploadedFileToSupabase(params: {
  file: File;
  folder: string;
  prefix?: string;
}) {
  const bytes = await params.file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = buildManagedFileName({
    originalName: params.file.name,
    prefix: params.prefix,
    contentType: params.file.type || "application/octet-stream"
  });
  const fileUrl = await uploadBufferToSupabase({
    buffer,
    contentType: params.file.type || "application/octet-stream",
    folder: params.folder,
    fileName
  });

  return {
    fileName: params.file.name,
    fileUrl,
    mimeType: params.file.type || null,
    sizeBytes: params.file.size
  };
}

async function saveUploadedFileLocally(params: {
  file: File;
  folder: string;
  prefix?: string;
}) {
  const bytes = await params.file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = buildManagedFileName({
    originalName: params.file.name,
    prefix: params.prefix,
    contentType: params.file.type || "application/octet-stream"
  });
  const fileUrl = await writeBufferLocally({
    buffer,
    folder: params.folder,
    fileName
  });

  return {
    fileName: params.file.name,
    fileUrl,
    mimeType: params.file.type || null,
    sizeBytes: params.file.size
  };
}

export async function saveUploadedFile(params: {
  file: File;
  folder: string;
  prefix?: string;
}) {
  const storage = getSupabaseStorageConfig();

  if (storage) {
    try {
      return await saveUploadedFileToSupabase(params);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[uploads] Falha no Supabase Storage em modo local, usando fallback local.", error);
        return saveUploadedFileLocally(params);
      }

      const message = error instanceof Error ? error.message : "Falha ao enviar arquivo para o storage.";
      if (/bucket not found/i.test(message)) {
        throw new Error(`Bucket "${storage.bucket}" nao encontrado no Supabase Storage.`);
      }

      throw error;
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Uploads locais estao desabilitados em producao. Configure o Supabase Storage.");
  }

  return saveUploadedFileLocally(params);
}

export async function cacheRemoteImage(params: {
  url: string;
  folder: string;
  prefix?: string;
}) {
  const sourceUrl = params.url.trim();

  if (!sourceUrl) {
    return null;
  }

  if (sourceUrl.startsWith("/")) {
    return sourceUrl;
  }

  let response: Response;

  try {
    response = await fetch(sourceUrl, {
      cache: "no-store",
      redirect: "follow"
    });
  } catch {
    return sourceUrl;
  }

  if (!response.ok) {
    return sourceUrl;
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return sourceUrl;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const originalName = new URL(sourceUrl).pathname.split("/").pop() || null;
  const fileName = buildManagedFileName({
    originalName,
    prefix: params.prefix,
    contentType
  });

  try {
    const storage = getSupabaseStorageConfig();

    if (storage) {
      return await uploadBufferToSupabase({
        buffer,
        contentType,
        folder: params.folder,
        fileName
      });
    }

    if (process.env.NODE_ENV === "production") {
      return sourceUrl;
    }

    return await writeBufferLocally({
      buffer,
      folder: params.folder,
      fileName
    });
  } catch {
    return sourceUrl;
  }
}
