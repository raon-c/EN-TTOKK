import { invoke } from "@tauri-apps/api/core";
import { normalizeAppError, PlatformError } from "./errors";
import { withRetry } from "./reliability";
import { createTraceId } from "./trace";

export interface InvokeCommandOptions {
  fallbackMessage: string;
  source?: string;
  code?: string;
  retries?: number;
  retryDelayMs?: number;
  backoffFactor?: number;
  maxRetryDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  traceId?: string;
  traceArgName?: string;
}

const hasRetryHint = (message: string): boolean => {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("timed out") ||
    lowered.includes("timeout") ||
    lowered.includes("temporarily") ||
    lowered.includes("rate limit") ||
    lowered.includes("retry")
  );
};

const defaultShouldRetry = (error: unknown, _attempt: number): boolean => {
  if (error instanceof PlatformError) return error.retryable;
  if (error instanceof Error) return hasRetryHint(error.message);
  if (typeof error === "string") return hasRetryHint(error);
  return false;
};

const buildPayload = (
  args: Record<string, unknown> | undefined,
  traceArgName: string | undefined,
  traceId: string
): Record<string, unknown> | undefined => {
  if (!traceArgName) return args;
  return { ...(args ?? {}), [traceArgName]: traceId };
};

export async function invokeCommand<T>(
  command: string,
  args: Record<string, unknown> | undefined,
  options: InvokeCommandOptions
): Promise<T> {
  const traceId = options.traceId ?? createTraceId();
  const payload = buildPayload(args, options.traceArgName, traceId);
  const execute = async () => invoke<T>(command, payload);

  try {
    if ((options.retries ?? 0) > 0) {
      return await withRetry(execute, {
        retries: options.retries ?? 0,
        baseDelayMs: options.retryDelayMs,
        factor: options.backoffFactor,
        maxDelayMs: options.maxRetryDelayMs,
        shouldRetry: options.shouldRetry ?? defaultShouldRetry,
      });
    }

    return await execute();
  } catch (error) {
    throw normalizeAppError(error, options.fallbackMessage, {
      code: options.code ?? "command_failed",
      retryable: false,
      traceId,
      source: options.source ?? `tauri:${command}`,
    });
  }
}
