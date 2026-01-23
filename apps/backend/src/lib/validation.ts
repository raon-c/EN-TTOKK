import { z } from "zod";

/**
 * Validates that a path does not contain directory traversal sequences
 */
const safePathString = z
  .string()
  .refine((path) => !path.includes(".."), {
    message: "Path cannot contain directory traversal sequences",
  })
  .refine((path) => !path.includes("\0"), {
    message: "Path cannot contain null bytes",
  });

/**
 * Schema for chat request validation
 */
export const chatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(100000, "Message too long"),
  workingDirectory: safePathString.optional(),
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  systemPrompt: z.string().max(10000).optional(),
});

/**
 * Schema for cancel request validation
 */
export const cancelRequestSchema = z.object({
  requestId: z.string().uuid("Invalid request ID format"),
});

export type ValidatedChatRequest = z.infer<typeof chatRequestSchema>;
export type ValidatedCancelRequest = z.infer<typeof cancelRequestSchema>;
