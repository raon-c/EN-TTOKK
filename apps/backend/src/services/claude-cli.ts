import type {
  ClaudeStatusResponse,
  ContentBlock,
  FrontendStreamChunk,
  StreamEvent,
  StreamEventType,
} from "@enttokk/api-types";

// Active process tracking for cancellation
const activeProcesses = new Map<
  string,
  { proc: ReturnType<typeof Bun.spawn>; aborted: boolean }
>();

/**
 * Check if Claude CLI is installed and available
 */
export async function checkClaudeCliStatus(): Promise<ClaudeStatusResponse> {
  try {
    const proc = Bun.spawn(["claude", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode === 0) {
      const stdout = await new Response(proc.stdout).text();
      const version = stdout.trim();
      return {
        status: "available",
        version,
      };
    }

    return {
      status: "unavailable",
      error: "Claude CLI exited with non-zero code",
    };
  } catch (error) {
    return {
      status: "unavailable",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse a single line of JSON from Claude CLI stream output
 */
function parseStreamLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as StreamEvent;
  } catch {
    // Not valid JSON, skip
    return null;
  }
}

type ContentBlockType = ContentBlock["type"];

type ContentBlockHandler<T extends ContentBlockType> = (
  block: Extract<ContentBlock, { type: T }>
) => FrontendStreamChunk[];

type ContentBlockHandlerMap = {
  [K in ContentBlockType]: ContentBlockHandler<K>;
};

export type ContentBlockHandlerOverrides = Partial<ContentBlockHandlerMap>;

type StreamEventHandler<T extends StreamEventType> = (
  event: Extract<StreamEvent, { type: T }>,
  contentHandlers: ContentBlockHandlerMap
) => FrontendStreamChunk[];

type StreamEventHandlerMap = {
  [K in StreamEventType]: StreamEventHandler<K>;
};

export type StreamEventHandlerOverrides = Partial<StreamEventHandlerMap>;

const defaultContentBlockHandlers: ContentBlockHandlerMap = {
  thinking: (block) => [
    {
      type: "thinking",
      thinking: block.thinking,
    },
  ],
  text: (block) => [
    {
      type: "text_delta",
      text: block.text,
    },
  ],
};

const defaultStreamEventHandlers: StreamEventHandlerMap = {
  system: (event) => [
    {
      type: "start",
      sessionId: event.session_id,
    },
  ],
  assistant: (event, contentHandlers) =>
    event.message.content.flatMap((block) =>
      handleContentBlock(
        block as Extract<ContentBlock, { type: typeof block.type }>,
        contentHandlers
      )
    ),
  user: () => [],
  result: (event) => [
    {
      type: "done",
      sessionId: event.session_id,
    },
  ],
  error: (event) => [
    {
      type: "error",
      error: event.error.message,
    },
  ],
};

const buildContentHandlers = (
  overrides?: ContentBlockHandlerOverrides
): ContentBlockHandlerMap => ({
  ...defaultContentBlockHandlers,
  ...(overrides ?? {}),
});

const buildStreamEventHandlers = (
  overrides?: StreamEventHandlerOverrides
): StreamEventHandlerMap => ({
  ...defaultStreamEventHandlers,
  ...(overrides ?? {}),
});

const handleContentBlock = <T extends ContentBlockType>(
  block: Extract<ContentBlock, { type: T }>,
  contentHandlers: ContentBlockHandlerMap
) => contentHandlers[block.type](block);

const handleStreamEvent = <T extends StreamEventType>(
  event: Extract<StreamEvent, { type: T }>,
  eventHandlers: StreamEventHandlerMap,
  contentHandlers: ContentBlockHandlerMap
) => eventHandlers[event.type](event, contentHandlers);

/**
 * Transform Claude CLI StreamEvent to simplified FrontendStreamChunk(s)
 * Returns an array because assistant events can contain multiple content blocks
 */
function transformToFrontendChunks(
  event: StreamEvent,
  eventHandlers: StreamEventHandlerMap,
  contentHandlers: ContentBlockHandlerMap
): FrontendStreamChunk[] {
  return handleStreamEvent(
    event as Extract<StreamEvent, { type: typeof event.type }>,
    eventHandlers,
    contentHandlers
  );
}

export interface StreamMessageOptions {
  message: string;
  workingDirectory?: string;
  systemPrompt?: string;
  sessionId?: string;
  requestId: string;
  eventHandlers?: StreamEventHandlerOverrides;
  contentHandlers?: ContentBlockHandlerOverrides;
}

/**
 * Stream messages from Claude CLI using --output-format stream-json
 */
export async function* streamMessage(
  options: StreamMessageOptions
): AsyncGenerator<FrontendStreamChunk> {
  const {
    message,
    workingDirectory,
    sessionId,
    requestId,
    eventHandlers,
    contentHandlers,
  } = options;
  const resolvedContentHandlers = buildContentHandlers(contentHandlers);
  const resolvedEventHandlers = buildStreamEventHandlers(eventHandlers);

  // Build command arguments
  // --verbose is required when using --output-format stream-json with -p (print mode)
  const args = ["claude", "--output-format", "stream-json", "--verbose"];

  // If we have a session ID, resume that session instead of starting new
  if (sessionId) {
    args.push("--resume", sessionId, "-p", message);
  } else {
    args.push("-p", message);
  }

  // Spawn the Claude CLI process
  const proc = Bun.spawn(args, {
    cwd: workingDirectory,
    stdout: "pipe",
    stderr: "pipe",
  });

  // Track the process for potential cancellation
  activeProcesses.set(requestId, { proc, aborted: false });

  try {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      // Check if aborted
      const processInfo = activeProcesses.get(requestId);
      if (processInfo?.aborted) {
        proc.kill();
        yield { type: "error", error: "Request cancelled" };
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining buffer
        if (buffer.trim()) {
          const event = parseStreamLine(buffer);
          if (event) {
            const chunks = transformToFrontendChunks(
              event,
              resolvedEventHandlers,
              resolvedContentHandlers
            );
            for (const chunk of chunks) {
              yield chunk;
            }
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (NDJSON format)
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const event = parseStreamLine(line);
        if (event) {
          const chunks = transformToFrontendChunks(
            event,
            resolvedEventHandlers,
            resolvedContentHandlers
          );
          for (const chunk of chunks) {
            yield chunk;
          }
        }
      }
    }

    // Wait for process to exit
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      // Read stderr for error details
      const stderr = await new Response(proc.stderr).text();
      yield {
        type: "error",
        error: stderr || `Claude CLI exited with code ${exitCode}`,
      };
    }
  } finally {
    activeProcesses.delete(requestId);
  }
}

/**
 * Cancel an active streaming request
 */
export function cancelRequest(requestId: string): boolean {
  const processInfo = activeProcesses.get(requestId);
  if (processInfo) {
    processInfo.aborted = true;
    processInfo.proc.kill();
    activeProcesses.delete(requestId);
    return true;
  }
  return false;
}

/**
 * Send a single message and get complete response (non-streaming)
 */
export async function sendMessage(options: {
  message: string;
  workingDirectory?: string;
  sessionId?: string;
  systemPrompt?: string;
}): Promise<{ content: string; sessionId?: string }> {
  const requestId = crypto.randomUUID();
  const {
    message,
    workingDirectory,
    sessionId: initialSessionId,
    systemPrompt,
  } = options;
  let content = "";
  let resolvedSessionId: string | undefined = initialSessionId;

  for await (const chunk of streamMessage({
    message,
    workingDirectory,
    sessionId: initialSessionId,
    systemPrompt,
    requestId,
  })) {
    if (chunk.type === "text_delta" && chunk.text) {
      content += chunk.text;
    } else if (chunk.type === "start" && chunk.sessionId) {
      resolvedSessionId = chunk.sessionId;
    } else if (chunk.type === "done" && chunk.sessionId) {
      resolvedSessionId = chunk.sessionId;
    } else if (chunk.type === "error") {
      throw new Error(chunk.error ?? "Unknown error");
    }
  }

  return { content, sessionId: resolvedSessionId };
}
