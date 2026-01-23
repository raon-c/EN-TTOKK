import type {
  ClaudeStatusResponse,
  FrontendStreamChunk,
  StreamEvent,
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

/**
 * Transform Claude CLI StreamEvent to simplified FrontendStreamChunk(s)
 * Returns an array because assistant events can contain multiple content blocks
 */
function transformToFrontendChunks(event: StreamEvent): FrontendStreamChunk[] {
  const chunks: FrontendStreamChunk[] = [];

  switch (event.type) {
    case "system":
      // System init event - emit start with session ID
      chunks.push({
        type: "start",
        sessionId: event.session_id,
      });
      break;

    case "assistant":
      // Assistant message contains content array with text and thinking blocks
      for (const block of event.message.content) {
        if (block.type === "thinking") {
          chunks.push({
            type: "thinking",
            thinking: block.thinking,
          });
        } else if (block.type === "text") {
          chunks.push({
            type: "text_delta",
            text: block.text,
          });
        }
      }
      break;

    case "user":
      // User message events - skip for frontend display
      break;

    case "result":
      chunks.push({
        type: "done",
        sessionId: event.session_id,
      });
      break;

    case "error":
      chunks.push({
        type: "error",
        error: event.error.message,
      });
      break;
  }

  return chunks;
}

export interface StreamMessageOptions {
  message: string;
  workingDirectory?: string;
  systemPrompt?: string;
  sessionId?: string;
  requestId: string;
}

/**
 * Stream messages from Claude CLI using --output-format stream-json
 */
export async function* streamMessage(
  options: StreamMessageOptions
): AsyncGenerator<FrontendStreamChunk> {
  const { message, workingDirectory, sessionId, requestId } = options;

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
            const chunks = transformToFrontendChunks(event);
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
          const chunks = transformToFrontendChunks(event);
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
export async function sendMessage(
  message: string,
  workingDirectory?: string
): Promise<{ content: string; sessionId?: string }> {
  const requestId = crypto.randomUUID();
  let content = "";
  let sessionId: string | undefined;

  for await (const chunk of streamMessage({
    message,
    workingDirectory,
    requestId,
  })) {
    if (chunk.type === "text_delta" && chunk.text) {
      content += chunk.text;
    } else if (chunk.type === "start" && chunk.sessionId) {
      sessionId = chunk.sessionId;
    } else if (chunk.type === "done" && chunk.sessionId) {
      sessionId = chunk.sessionId;
    } else if (chunk.type === "error") {
      throw new Error(chunk.error ?? "Unknown error");
    }
  }

  return { content, sessionId };
}
