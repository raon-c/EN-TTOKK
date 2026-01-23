import type {
  ChatRequest,
  ChatResponse,
  ClaudeStatusResponse,
  FrontendStreamChunk,
  GoogleCalendarAuthResult,
  GoogleCalendarEventsResponse,
  GoogleCalendarTokenResponse,
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
        onChunk?: (chunk: FrontendStreamChunk) => void;
        handlers?: Partial<
          Record<
            FrontendStreamChunk["type"],
            (chunk: FrontendStreamChunk) => void
          >
        >;
      }
    ): { abort: () => void } {
      const abortController = new AbortController();

      const defaultHandlers: Record<
        FrontendStreamChunk["type"],
        (chunk: FrontendStreamChunk) => void
      > = {
        start: (chunk) => callbacks.onStart?.(chunk.sessionId),
        text_delta: (chunk) => {
          if (chunk.text) callbacks.onTextDelta?.(chunk.text);
        },
        thinking: (chunk) => {
          if (chunk.thinking) callbacks.onThinking?.(chunk.thinking);
        },
        tool_use: (chunk) => {
          if (chunk.tool) callbacks.onToolUse?.(chunk.tool);
        },
        tool_result: (chunk) => {
          if (chunk.toolResult) callbacks.onToolResult?.(chunk.toolResult);
        },
        done: (chunk) => callbacks.onDone?.(chunk.sessionId),
        error: (chunk) => callbacks.onError?.(chunk.error ?? "Unknown error"),
        ping: () => {},
      };

      const resolvedHandlers: Record<
        FrontendStreamChunk["type"],
        (chunk: FrontendStreamChunk) => void
      > = {
        ...defaultHandlers,
        ...(callbacks.handlers ?? {}),
      };

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
                  callbacks.onChunk?.(chunk);
                  const handler =
                    resolvedHandlers[chunk.type as FrontendStreamChunk["type"]];
                  handler?.(chunk);
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

  // Google Calendar integration methods
  googleCalendar: {
    async pollAuthResult(state: string): Promise<GoogleCalendarAuthResult> {
      const response = await fetchWithTimeout(
        `${BACKEND_URL}/oauth/google/result?state=${encodeURIComponent(state)}`
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? `Auth poll failed: ${response.status}`);
      }
      return response.json();
    },

    async exchangeToken(params: {
      grantType: "authorization_code" | "refresh_token";
      code?: string;
      codeVerifier?: string;
      refreshToken?: string;
      redirectUri: string;
      clientId: string;
      clientSecret?: string;
    }): Promise<GoogleCalendarTokenResponse> {
      const response = await fetchWithTimeout(
        `${BACKEND_URL}/integrations/google/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          timeout: 15000,
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? `Token exchange failed: ${response.status}`);
      }
      return data;
    },

    async listEvents(params: {
      accessToken: string;
      calendarId?: string;
      timeMin?: string;
      timeMax?: string;
      syncToken?: string;
      pageToken?: string;
      maxResults?: number;
    }): Promise<{ status: number; data: GoogleCalendarEventsResponse }> {
      const response = await fetchWithTimeout(
        `${BACKEND_URL}/integrations/google/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          timeout: 15000,
        }
      );
      const data = await response.json().catch(() => ({}));
      return { status: response.status, data };
    },
  },
};
