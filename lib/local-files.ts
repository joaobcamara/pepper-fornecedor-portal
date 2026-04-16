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

async function saveUploadedFileToSupabase(params: {
  file: File;
  folder: string;
  prefix?: string;
}) {
  const storage = getSupabaseStorageConfig();

  if (!storage) {
    throw new Error("Supabase Storage nao configurado.");
  }

  const bytes = await params.file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const extension = path.extname(params.file.name) || "";
  const prefix = params.prefix ? `${sanitizeSegment(params.prefix)}-` : "";
  const fileName = `${prefix}${randomUUID()}${extension}`;
  const relativeFolder = params.folder.replace(/^\/+/, "");
  const objectPath = `${relativeFolder}/${fileName}`.replace(/\\/g, "/");

  const response = await fetch(`${storage.url}/storage/v1/object/${storage.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${storage.serviceRoleKey}`,
      apikey: storage.serviceRoleKey,
      "Content-Type": params.file.type || "application/octet-stream",
      "x-upsert": "false"
    },
    body: buffer
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Falha no upload para o Supabase Storage: ${response.status} ${errorBody}`.trim());
  }

  return {
    fileName: params.file.name,
    fileUrl: `${storage.url}/storage/v1/object/public/${storage.bucket}/${objectPath}`,
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
  const extension = path.extname(params.file.name) || "";
  const prefix = params.prefix ? `${sanitizeSegment(params.prefix)}-` : "";
  const fileName = `${prefix}${randomUUID()}${extension}`;
  const relativeFolder = params.folder.replace(/^\/+/, "");
  const absoluteFolder = path.join(PUBLIC_DIR, relativeFolder);

  await mkdir(absoluteFolder, { recursive: true });
  await writeFile(path.join(absoluteFolder, fileName), buffer);

  return {
    fileName: params.file.name,
    fileUrl: `/${relativeFolder}/${fileName}`.replace(/\\/g, "/"),
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
