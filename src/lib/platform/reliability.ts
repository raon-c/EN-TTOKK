export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const clamp = (value: number, max: number) =>
  Number.isFinite(max) ? Math.min(value, max) : value;

export async function withRetry<T>(
  task: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const retries = Math.max(0, options.retries);
  const baseDelayMs = options.baseDelayMs ?? 300;
  const factor = options.factor ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 4000;
  const shouldRetry =
    options.shouldRetry ??
    (() => {
      return true;
    });

  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error, attempt + 1)) {
        throw error;
      }

      const delay = clamp(baseDelayMs * factor ** attempt, maxDelayMs);
      await sleep(delay);
      attempt += 1;
    }
  }
}
