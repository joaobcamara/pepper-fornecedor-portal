const DEFAULT_TINY_FALLBACK_TIMEOUT_MS = 4500;

export function getTinyFallbackTimeoutMs() {
  const configured = Number(process.env.TINY_FALLBACK_TIMEOUT_MS ?? DEFAULT_TINY_FALLBACK_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1000 ? configured : DEFAULT_TINY_FALLBACK_TIMEOUT_MS;
}

export async function withTinyFallbackTimeout<T>(
  operation: Promise<T>,
  options?: {
    timeoutMs?: number;
    message?: string;
  }
) {
  const timeoutMs =
    Number.isFinite(options?.timeoutMs) && (options?.timeoutMs ?? 0) >= 1000
      ? Number(options?.timeoutMs)
      : getTinyFallbackTimeoutMs();
  const timeoutMessage =
    options?.message ??
    "O fallback do Tiny Pepper demorou demais para responder. A fundacao segue como fonte principal e o sistema interrompeu a consulta externa temporariamente.";

  return await Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    })
  ]);
}
