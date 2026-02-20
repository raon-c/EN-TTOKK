import type {
  ChatRequest,
  ChatResponse,
  ClaudeStatusResponse,
  FrontendStreamChunk,
  GoogleCalendarAuthResult,
  GoogleCalendarEventsResponse,
  GoogleCalendarTokenResponse,
  HealthResponse,
  JiraIssuesRequest,
  JiraIssuesResponse,
  JiraTestRequest,
  JiraTestResponse,
} from "@enttokk/api-types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const CHAT_STREAM_EVENT = "chat-stream-chunk";

type ChatStreamEventPayload = {
  requestId: string;
  chunk: FrontendStreamChunk;
};

type HttpProxyResponse = {
  status: number;
  dataJson: string;
};

const parseJson = <T>(jsonText: string, fallback: T): T => {
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return fallback;
  }
};

const resolveErrorMessage = (
  error: unknown,
  fallback: string = "Unknown error"
): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
};

const resolveGoogleTokenErrorMessage = (
  data: Record<string, unknown>,
  status: number
): string => {
  const errorCode =
    typeof data.error === "string"
      ? data.error
      : typeof data.error === "object" &&
          data.error !== null &&
          typeof (data.error as { message?: unknown }).message === "string"
        ? ((data.error as { message?: string }).message ?? undefined)
        : undefined;

  const errorDescription =
    typeof data.error_description === "string"
      ? data.error_description
      : typeof data.errorDescription === "string"
        ? data.errorDescription
        : undefined;

  if (errorCode && errorDescription) return `${errorCode}: ${errorDescription}`;
  if (errorDescription) return errorDescription;
  if (errorCode) return errorCode;
  return `Token exchange failed: ${status}`;
};

export const apiClient = {
  async healthCheck(): Promise<HealthResponse> {
    return invoke<HealthResponse>("ipc_health_check");
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
      return invoke<ClaudeStatusResponse>("chat_check_status");
    },

    async sendMessage(request: ChatRequest): Promise<ChatResponse> {
      const conversationId = request.conversationId ?? crypto.randomUUID();
      let content = "";
      let resolvedSessionId = request.sessionId;

      await new Promise<void>((resolve, reject) => {
        let finalized = false;

        const finalize = (cb: () => void) => {
          if (finalized) return;
          finalized = true;
          cb();
        };

        this.streamMessage(request, {
          onStart: (sessionId) => {
            if (sessionId) resolvedSessionId = sessionId;
          },
          onTextDelta: (text) => {
            content += text;
          },
          onDone: (sessionId) => {
            if (sessionId) resolvedSessionId = sessionId;
            finalize(resolve);
          },
          onError: (error) => {
            finalize(() => reject(new Error(error)));
          },
        });
      });

      return {
        message: {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          timestamp: new Date().toISOString(),
        },
        conversationId,
        sessionId: resolvedSessionId,
      };
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

      const requestId = crypto.randomUUID();
      let isClosed = false;
      const unlistenPromise = listen<ChatStreamEventPayload>(
        CHAT_STREAM_EVENT,
        (event) => {
          if (isClosed || event.payload.requestId !== requestId) return;

          const chunk = event.payload.chunk;
          callbacks.onChunk?.(chunk);
          const handler =
            resolvedHandlers[chunk.type as FrontendStreamChunk["type"]];
          handler?.(chunk);

          if (chunk.type === "done" || chunk.type === "error") {
            void cleanup();
          }
        }
      );

      const cleanup = async () => {
        if (isClosed) return;
        isClosed = true;
        const unlisten = await unlistenPromise.catch(() => null);
        unlisten?.();
      };

      (async () => {
        try {
          await invoke("chat_start_stream", {
            input: {
              requestId,
              message: request.message,
              workingDirectory: request.workingDirectory,
              sessionId: request.sessionId,
              systemPrompt: request.systemPrompt,
              conversationId: request.conversationId,
            },
          });
        } catch (error) {
          await cleanup();
          callbacks.onError?.(resolveErrorMessage(error));
        }
      })();

      return {
        abort: () => {
          void (async () => {
            await invoke("chat_cancel_stream", { requestId }).catch(() => null);
            await cleanup();
          })();
        },
      };
    },

    async cancelRequest(requestId: string): Promise<{ cancelled: boolean }> {
      const cancelled = await invoke<boolean>("chat_cancel_stream", {
        requestId,
      });
      return { cancelled };
    },
  },

  // Google Calendar integration methods
  googleCalendar: {
    async prepareOAuth(state: string): Promise<void> {
      await invoke("google_prepare_oauth", { state });
    },

    async pollAuthResult(state: string): Promise<GoogleCalendarAuthResult> {
      return invoke<GoogleCalendarAuthResult>("google_poll_oauth_result", {
        state,
      });
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
      const response = await invoke<HttpProxyResponse>(
        "google_exchange_token",
        {
          params,
        }
      );
      const data = parseJson<Record<string, unknown>>(response.dataJson, {});
      if (response.status >= 400) {
        throw new Error(resolveGoogleTokenErrorMessage(data, response.status));
      }
      return data as unknown as GoogleCalendarTokenResponse;
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
      const response = await invoke<HttpProxyResponse>("google_list_events", {
        params,
      });
      const data = parseJson<GoogleCalendarEventsResponse>(
        response.dataJson,
        {}
      );
      return { status: response.status, data };
    },
  },

  // Jira integration methods
  jira: {
    async testConnection(params: JiraTestRequest): Promise<JiraTestResponse> {
      try {
        return await invoke<JiraTestResponse>("jira_test_connection", {
          params,
        });
      } catch (error) {
        throw new Error(resolveErrorMessage(error, "Jira test failed"));
      }
    },

    async listIssues(params: JiraIssuesRequest): Promise<JiraIssuesResponse> {
      try {
        return await invoke<JiraIssuesResponse>("jira_list_issues", { params });
      } catch (error) {
        throw new Error(resolveErrorMessage(error, "Jira issues failed"));
      }
    },
  },
};
