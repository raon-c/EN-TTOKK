// Chat message roles
export type ChatRole = "user" | "assistant";

// Stream event types from Claude CLI --output-format stream-json
export type StreamEventType =
  | "system"
  | "assistant"
  | "user"
  | "result"
  | "error";

// Base stream event interface
interface BaseStreamEvent {
  type: StreamEventType;
}

// Content block types within assistant message
export interface TextContentBlock {
  type: "text";
  text: string;
}

export interface ThinkingContentBlock {
  type: "thinking";
  thinking: string;
}

export type ContentBlock = TextContentBlock | ThinkingContentBlock;

// System init event
export interface SystemStreamEvent extends BaseStreamEvent {
  type: "system";
  subtype: "init";
  session_id: string;
  cwd?: string;
  tools?: string[];
  mcp_servers?: Record<string, unknown>[];
}

// Assistant message event (contains content array)
export interface AssistantStreamEvent extends BaseStreamEvent {
  type: "assistant";
  message: {
    id: string;
    type: "message";
    role: "assistant";
    model: string;
    content: ContentBlock[];
    stop_reason?: string | null;
    stop_sequence?: string | null;
  };
}

// User message event
export interface UserStreamEvent extends BaseStreamEvent {
  type: "user";
  message: {
    role: "user";
    content: ContentBlock[];
  };
}

// Result/completion event
export interface ResultStreamEvent extends BaseStreamEvent {
  type: "result";
  subtype: "success" | "error";
  result?: string;
  is_error?: boolean;
  duration_ms?: number;
  num_turns?: number;
  session_id?: string;
  total_cost_usd?: number;
}

// Error event
export interface ErrorStreamEvent extends BaseStreamEvent {
  type: "error";
  error: {
    message: string;
    code?: string;
  };
}

// Union type for all stream events
export type StreamEvent =
  | SystemStreamEvent
  | AssistantStreamEvent
  | UserStreamEvent
  | ResultStreamEvent
  | ErrorStreamEvent;

// Simplified frontend stream chunk for SSE
export type FrontendStreamChunkType =
  | "start"
  | "text_delta"
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "done"
  | "error"
  | "ping"; // Keepalive ping

export interface FrontendStreamChunk {
  type: FrontendStreamChunkType;
  text?: string;
  thinking?: string;
  tool?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  toolResult?: string;
  sessionId?: string;
  error?: string;
  timestamp?: number; // For ping events
}

// Chat message structure
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  thinking?: string;
  toolUse?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
    result?: string;
  }[];
  timestamp: string;
}

// Chat request from frontend
export interface ChatRequest {
  message: string;
  conversationId?: string;
  sessionId?: string; // Claude CLI session ID for context persistence
  systemPrompt?: string;
  workingDirectory?: string;
}

// Chat response (non-streaming)
export interface ChatResponse {
  message: ChatMessage;
  conversationId: string;
  sessionId?: string;
}

// Claude CLI status
export type ClaudeCliStatus = "available" | "unavailable" | "checking";

// Status check response
export interface ClaudeStatusResponse {
  status: ClaudeCliStatus;
  version?: string;
  error?: string;
}
