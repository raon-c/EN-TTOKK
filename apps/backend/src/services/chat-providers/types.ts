import type {
  ClaudeStatusResponse,
  FrontendStreamChunk,
} from "@enttokk/api-types";

export interface SendMessageInput {
  message: string;
  workingDirectory?: string;
  sessionId?: string;
  systemPrompt?: string;
  conversationId?: string;
}

export interface StreamMessageInput extends SendMessageInput {
  requestId: string;
}

export interface ChatProvider {
  name: string;
  checkStatus: () => Promise<ClaudeStatusResponse>;
  sendMessage: (
    input: SendMessageInput
  ) => Promise<{ content: string; sessionId?: string }>;
  streamMessage: (
    input: StreamMessageInput
  ) => AsyncGenerator<FrontendStreamChunk>;
  cancelRequest: (requestId: string) => boolean;
}
