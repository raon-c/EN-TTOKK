// Health check response type
export interface HealthResponse {
  status: "ok" | "error";
  timestamp: string;
}

// Chat types
export type {
  AssistantStreamEvent,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatRole,
  ClaudeCliStatus,
  ClaudeStatusResponse,
  ContentBlock,
  ErrorStreamEvent,
  FrontendStreamChunk,
  FrontendStreamChunkType,
  ResultStreamEvent,
  StreamEvent,
  StreamEventType,
  SystemStreamEvent,
  TextContentBlock,
  ThinkingContentBlock,
  UserStreamEvent,
} from "./chat";

// Generic API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
