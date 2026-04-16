const DEFAULT_TINY_FALLBACK_TIMEOUT_MS = 4500;

export function getTinyFallbackTimeoutMs() {
  const configured = Number(process.env.TINY_FALLBACK_TIMEOUT_MS ?? DEFAULT_TINY_FALLBACK_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1000 ? configured : DEFAULT_TINY_FALLBACK_TIMEOUT_MS;
}

export async function withTinyFallbackTimeout<T>(operation: Promise<T>) {
  const timeoutMs = getTinyFallbackTimeoutMs();

  return await Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            "O fallback do Tiny Pepper demorou demais para responder. A fundacao segue como fonte principal e o sistema interrompeu a consulta externa temporariamente."
          )
        );
      }, timeoutMs);
    })
  ]);
}
