import type { AppError as AppErrorShape } from "@/types/api";
import { createTraceId } from "./trace";

type ErrorRecord = Record<string, unknown>;

type ErrorFallback = Partial<
  Pick<AppErrorShape, "code" | "retryable" | "traceId" | "source">
>;

const isRecord = (value: unknown): value is ErrorRecord =>
  typeof value === "object" && value !== null;

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  return undefined;
};

const parseJsonRecord = (value: string): ErrorRecord | null => {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractErrorRecord = (error: unknown): ErrorRecord | null => {
  if (isRecord(error)) {
    if (isRecord(error.error)) return error.error;
    if (isRecord(error.data)) return error.data;
    return error;
  }

  if (typeof error === "string") {
    return parseJsonRecord(error);
  }

  if (error instanceof Error) {
    const parsed = parseJsonRecord(error.message);
    if (parsed) return parsed;

    const cause = (error as Error & { cause?: unknown }).cause;
    if (isRecord(cause)) return cause;
  }

  return null;
};

const pickMessage = (
  error: unknown,
  fallbackMessage: string,
  fromRecord?: string
): string => {
  if (fromRecord) return fromRecord;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallbackMessage;
};

export class PlatformError extends Error implements AppErrorShape {
  readonly code: string;
  readonly retryable: boolean;
  readonly traceId: string;
  readonly source: string;

  constructor(data: AppErrorShape) {
    super(data.message);
    this.name = "PlatformError";
    this.code = data.code;
    this.retryable = data.retryable;
    this.traceId = data.traceId;
    this.source = data.source;
  }
}

export const normalizeAppError = (
  error: unknown,
  fallbackMessage: string,
  fallback: ErrorFallback = {}
): PlatformError => {
  if (error instanceof PlatformError) return error;

  const record = extractErrorRecord(error);
  const traceId =
    asNonEmptyString(record?.traceId) ?? fallback.traceId ?? createTraceId();

  return new PlatformError({
    code:
      asNonEmptyString(record?.code) ??
      fallback.code ??
      "unknown_command_error",
    message: pickMessage(
      error,
      fallbackMessage,
      asNonEmptyString(record?.message)
    ),
    retryable: asBoolean(record?.retryable) ?? fallback.retryable ?? false,
    traceId,
    source:
      asNonEmptyString(record?.source) ?? fallback.source ?? "frontend.invoke",
  });
};

export const toErrorMessage = (
  error: unknown,
  fallbackMessage = "Unknown error"
): string => normalizeAppError(error, fallbackMessage).message;
