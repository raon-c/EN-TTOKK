import type {
  ChatRequest,
  ChatResponse,
  ClaudeStatusResponse,
  FrontendStreamChunk,
  HealthResponse,
} from "@enttokk/api-types";

const BACKEND_PORT = 31337;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

interface FetchOptions extends RequestInit {
  timeout?: number;
}

async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 5000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  async healthCheck(): Promise<HealthResponse> {
    const response = await fetchWithTimeout(`${BACKEND_URL}/healthz`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  },

  async waitForBackend(maxRetries = 30, retryDelay = 500): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.healthCheck();
        return true;
      } catch {
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }
    return false;
  },

  // Chat API methods
  chat: {
    async checkStatus(): Promise<ClaudeStatusResponse> {
      const response = await fetchWithTimeout(`${BACKEND_URL}/chat/status`);
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      return response.json();
    },

    async sendMessage(request: ChatRequest): Promise<ChatResponse> {
      const response = await fetchWithTimeout(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        timeout: 120000, // 2 minutes for non-streaming
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? `Chat failed: ${response.status}`);
      }
      return response.json();
    },

    streamMessage(
      request: ChatRequest,
      callbacks: {
        onStart?: (sessionId?: string) => void;
        onTextDelta?: (text: string) => void;
        onThinking?: (thinking: string) => void;
        onToolUse?: (tool: {
          id: string;
          name: string;
          input: Record<string, unknown>;
        }) => void;
        onToolResult?: (result: string) => void;
        onDone?: (sessionId?: string) => void;
        onError?: (error: string) => void;
      }
    ): { abort: () => void } {
      const abortController = new AbortController();

      (async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
            signal: abortController.signal,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            callbacks.onError?.(
              error.error ?? `Stream failed: ${response.status}`
            );
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            callbacks.onError?.("No response body");
            return;
          }

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const chunk = JSON.parse(
                    line.slice(6)
                  ) as FrontendStreamChunk;
                  switch (chunk.type) {
                    case "start":
                      callbacks.onStart?.(chunk.sessionId);
                      break;
                    case "text_delta":
                      if (chunk.text) callbacks.onTextDelta?.(chunk.text);
                      break;
                    case "thinking":
                      if (chunk.thinking)
                        callbacks.onThinking?.(chunk.thinking);
                      break;
                    case "tool_use":
                      if (chunk.tool) callbacks.onToolUse?.(chunk.tool);
                      break;
                    case "tool_result":
                      if (chunk.toolResult)
                        callbacks.onToolResult?.(chunk.toolResult);
                      break;
                    case "done":
                      callbacks.onDone?.(chunk.sessionId);
                      break;
                    case "error":
                      callbacks.onError?.(chunk.error ?? "Unknown error");
                      break;
                    case "ping":
                      // Keepalive ping - ignore
                      break;
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return;
          }
          callbacks.onError?.(
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      })();

      return {
        abort: () => abortController.abort(),
      };
    },

    async cancelRequest(requestId: string): Promise<{ cancelled: boolean }> {
      const response = await fetchWithTimeout(`${BACKEND_URL}/chat/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      return response.json();
    },
  },
};
