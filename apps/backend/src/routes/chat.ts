import type { ClaudeStatusResponse } from "@enttokk/api-types";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { logger } from "../lib/logger";
import { cancelRequestSchema, chatRequestSchema } from "../lib/validation";
import {
  cancelRequest,
  checkClaudeCliStatus,
  sendMessage,
  streamMessage,
} from "../services/claude-cli";

const KEEPALIVE_INTERVAL_MS = 15000;

const chat = new Hono();

/**
 * GET /chat/status
 * Check if Claude CLI is available
 */
chat.get("/status", async (c) => {
  const status: ClaudeStatusResponse = await checkClaudeCliStatus();
  return c.json(status);
});

/**
 * POST /chat
 * Send a message and get complete response (non-streaming)
 */
chat.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      400
    );
  }

  const { message, workingDirectory } = parsed.data;

  try {
    const result = await sendMessage(message, workingDirectory);
    return c.json({
      message: {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        content: result.content,
        timestamp: new Date().toISOString(),
      },
      sessionId: result.sessionId,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

/**
 * POST /chat/stream
 * Stream a message response using SSE
 */
chat.post("/stream", async (c) => {
  const body = await c.req.json();
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      400
    );
  }

  const { message, workingDirectory, sessionId } = parsed.data;
  const requestId = crypto.randomUUID();

  return streamSSE(
    c,
    async (stream) => {
      // Keepalive interval to prevent connection timeout
      const keepaliveInterval = setInterval(async () => {
        try {
          await stream.writeSSE({
            event: "ping",
            data: JSON.stringify({ type: "ping", timestamp: Date.now() }),
            id: requestId,
          });
        } catch {
          // Connection might be closed, ignore
        }
      }, KEEPALIVE_INTERVAL_MS);

      try {
        for await (const chunk of streamMessage({
          message,
          workingDirectory,
          sessionId,
          requestId,
        })) {
          await stream.writeSSE({
            event: chunk.type,
            data: JSON.stringify(chunk),
            id: requestId,
          });
        }
      } catch (error) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          }),
          id: requestId,
        });
      } finally {
        clearInterval(keepaliveInterval);
      }
    },
    async (error) => {
      logger.error("SSE stream error", { error });
    }
  );
});

/**
 * POST /chat/cancel
 * Cancel an active streaming request
 */
chat.post("/cancel", async (c) => {
  const body = await c.req.json();
  const parsed = cancelRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      400
    );
  }

  const cancelled = cancelRequest(parsed.data.requestId);
  return c.json({ cancelled });
});

export default chat;
