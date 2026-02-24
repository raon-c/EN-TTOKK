import { listen } from "@tauri-apps/api/event";
import { invokeCommand, normalizeAppError, withRetry } from "@/lib/platform";
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
} from "@/types/api";

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
    return invokeCommand<HealthResponse>("ipc_health_check", undefined, {
      fallbackMessage: "Failed to connect to app service",
      source: "backend.health",
      code: "backend_unavailable",
      retries: 1,
      retryDelayMs: 200,
      traceArgName: "traceId",
    });
  },

  async waitForBackend(maxRetries = 30, retryDelay = 500): Promise<boolean> {
    try {
      await withRetry(() => this.healthCheck(), {
        retries: Math.max(0, maxRetries - 1),
        baseDelayMs: retryDelay,
        factor: 1,
        shouldRetry: () => true,
      });
      return true;
    } catch {
      return false;
    }
  },

  // Chat API methods
  chat: {
    async checkStatus(): Promise<ClaudeStatusResponse> {
      return invokeCommand<ClaudeStatusResponse>(
        "chat_check_status",
        undefined,
        {
          fallbackMessage: "Failed to check Claude CLI status",
          source: "backend.chat.status",
          code: "chat_status_failed",
        }
      );
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

      void (async () => {
        try {
          await invokeCommand<null>(
            "chat_start_stream",
            {
              input: {
                requestId,
                message: request.message,
                workingDirectory: request.workingDirectory,
                sessionId: request.sessionId,
                systemPrompt: request.systemPrompt,
                conversationId: request.conversationId,
              },
            },
            {
              fallbackMessage: "Failed to start Claude stream",
              source: "backend.chat.stream",
              code: "chat_stream_start_failed",
              traceArgName: "traceId",
            }
          );
        } catch (error) {
          await cleanup();
          const appError = normalizeAppError(
            error,
            "Failed to start Claude stream"
          );
          callbacks.onError?.(
            `${appError.message} (trace: ${appError.traceId})`
          );
        }
      })();

      return {
        abort: () => {
          void (async () => {
            await invokeCommand<boolean>(
              "chat_cancel_stream",
              { requestId },
              {
                fallbackMessage: "Failed to cancel Claude stream",
                source: "backend.chat.cancel",
                code: "chat_stream_cancel_failed",
                traceArgName: "traceId",
              }
            ).catch(() => null);
            await cleanup();
          })();
        },
      };
    },

    async cancelRequest(requestId: string): Promise<{ cancelled: boolean }> {
      const cancelled = await invokeCommand<boolean>(
        "chat_cancel_stream",
        { requestId },
        {
          fallbackMessage: "Failed to cancel Claude stream",
          source: "backend.chat.cancel",
          code: "chat_stream_cancel_failed",
          traceArgName: "traceId",
        }
      );
      return { cancelled };
    },
  },

  // Google Calendar integration methods
  googleCalendar: {
    async prepareOAuth(state: string): Promise<void> {
      await invokeCommand<null>(
        "google_prepare_oauth",
        { state },
        {
          fallbackMessage: "Failed to prepare Google OAuth",
          source: "backend.google.oauth.prepare",
          code: "google_oauth_prepare_failed",
          traceArgName: "traceId",
        }
      );
    },

    async pollAuthResult(state: string): Promise<GoogleCalendarAuthResult> {
      return invokeCommand<GoogleCalendarAuthResult>(
        "google_poll_oauth_result",
        { state },
        {
          fallbackMessage: "Failed to poll Google OAuth result",
          source: "backend.google.oauth.poll",
          code: "google_oauth_poll_failed",
          traceArgName: "traceId",
        }
      );
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
      const response = await invokeCommand<HttpProxyResponse>(
        "google_exchange_token",
        {
          params,
        },
        {
          fallbackMessage: "Google token exchange failed",
          source: "backend.google.oauth.exchange",
          code: "google_token_exchange_failed",
          traceArgName: "traceId",
        }
      );

      const data = parseJson<Record<string, unknown>>(response.dataJson, {});
      if (response.status >= 400) {
        throw normalizeAppError(
          new Error(resolveGoogleTokenErrorMessage(data, response.status)),
          "Google token exchange failed",
          {
            code: "google_token_exchange_failed",
            retryable: response.status >= 500 || response.status === 429,
            source: "backend.google.oauth.exchange",
          }
        );
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
      const response = await invokeCommand<HttpProxyResponse>(
        "google_list_events",
        {
          params,
        },
        {
          fallbackMessage: "Failed to fetch Google Calendar events",
          source: "backend.google.events.list",
          code: "google_events_failed",
          traceArgName: "traceId",
        }
      );

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
      return invokeCommand<JiraTestResponse>(
        "jira_test_connection",
        { params },
        {
          fallbackMessage: "Jira test failed",
          source: "backend.jira.test",
          code: "jira_test_failed",
          traceArgName: "traceId",
        }
      );
    },

    async listIssues(params: JiraIssuesRequest): Promise<JiraIssuesResponse> {
      return invokeCommand<JiraIssuesResponse>(
        "jira_list_issues",
        { params },
        {
          fallbackMessage: "Jira issues failed",
          source: "backend.jira.issues",
          code: "jira_issues_failed",
          traceArgName: "traceId",
        }
      );
    },
  },
};
