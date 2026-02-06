import type { ChatMessage, ClaudeCliStatus } from "@enttokk/api-types";
import { create } from "zustand";

import { buildDailySummaryPrompt } from "@/features/daily-summary/buildDailySummaryPrompt";
import { apiClient } from "@/lib/api-client";

interface ActiveTool {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface StreamingState {
  isStreaming: boolean;
  currentText: string;
  currentThinking: string | null;
  activeTool: ActiveTool | null;
}

interface Conversation {
  id: string;
  messages: ChatMessage[];
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ChatStore {
  conversations: Map<string, Conversation>;
  activeConversationId: string | null;
  streamingState: StreamingState;
  claudeStatus: ClaudeCliStatus;
  isCheckingStatus: boolean;
  error: string | null;
  abortStream: (() => void) | null;

  // Internal actions
  setError: (error: string | null) => void;
  createConversation: () => string;
  setActiveConversation: (id: string | null) => void;
  getActiveConversation: () => Conversation | null;
  cancelStreaming: () => void;

  // Public actions
  checkClaudeStatus: () => Promise<void>;
  sendMessage: (content: string, workingDirectory?: string) => Promise<void>;
  sendDailySummary: (workingDirectory?: string) => Promise<void>;
}

const initialStreamingState: StreamingState = {
  isStreaming: false,
  currentText: "",
  currentThinking: null,
  activeTool: null,
};

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: new Map(),
  activeConversationId: null,
  streamingState: { ...initialStreamingState },
  claudeStatus: "checking",
  isCheckingStatus: false,
  error: null,
  abortStream: null,

  setError: (error) => set({ error }),

  createConversation: () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id,
      messages: [],
      sessionId: null,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const newConversations = new Map(state.conversations);
      newConversations.set(id, conversation);
      return {
        conversations: newConversations,
        activeConversationId: id,
      };
    });

    return id;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    if (!activeConversationId) return null;
    return conversations.get(activeConversationId) ?? null;
  },

  cancelStreaming: () => {
    const { abortStream } = get();
    if (abortStream) abortStream();
    set({
      streamingState: { ...initialStreamingState },
      abortStream: null,
    });
  },

  checkClaudeStatus: async () => {
    set({ isCheckingStatus: true });
    try {
      const status = await apiClient.chat.checkStatus();
      set({ claudeStatus: status.status });
      if (status.status === "unavailable") {
        set({ error: status.error ?? "Claude CLI is not available" });
      }
    } catch (err) {
      set({
        claudeStatus: "unavailable",
        error:
          err instanceof Error
            ? err.message
            : "Failed to check Claude CLI status",
      });
    } finally {
      set({ isCheckingStatus: false });
    }
  },

  sendMessage: async (content: string, workingDirectory?: string) => {
    if (!content.trim()) return;
    const { claudeStatus } = get();
    if (claudeStatus !== "available") {
      set({ error: "Claude CLI is not available" });
      return;
    }

    await sendStreamingMessage(get, set, {
      requestMessage: content,
      displayMessage: content,
      workingDirectory,
    });
  },

  sendDailySummary: async (workingDirectory?: string) => {
    try {
      const request = await buildDailySummaryPrompt();
      await sendStreamingMessage(get, set, {
        requestMessage: request.requestMessage,
        displayMessage: request.displayMessage,
        workingDirectory,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to build daily summary",
      });
    }
  },
}));

// Shared streaming logic used by sendMessage and sendDailySummary
function sendStreamingMessage(
  get: () => ChatStore,
  set: (
    partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)
  ) => void,
  params: {
    requestMessage: string;
    displayMessage?: string;
    workingDirectory?: string;
  }
): void {
  let conversationId = get().activeConversationId;
  if (!conversationId) {
    conversationId = get().createConversation();
  }

  const conversation = get().conversations.get(conversationId);
  const currentSessionId = conversation?.sessionId ?? null;

  // Add user message
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: (params.displayMessage ?? params.requestMessage).trim(),
    timestamp: new Date().toISOString(),
  };
  addMessage(get, set, conversationId, userMessage);

  // Start streaming
  const { abort } = apiClient.chat.streamMessage(
    {
      message: params.requestMessage.trim(),
      workingDirectory: params.workingDirectory,
      conversationId,
      sessionId: currentSessionId ?? undefined,
    },
    {
      onStart: (sessionId) => {
        if (sessionId && conversationId) {
          setSessionId(get, set, conversationId, sessionId);
        }
      },
      onTextDelta: (text) => {
        set((state) => ({
          streamingState: {
            ...state.streamingState,
            currentText: state.streamingState.currentText + text,
          },
        }));
      },
      onThinking: (thinking) => {
        set((state) => ({
          streamingState: {
            ...state.streamingState,
            currentThinking: thinking,
          },
        }));
      },
      onToolUse: (tool) => {
        set((state) => ({
          streamingState: {
            ...state.streamingState,
            activeTool: tool,
          },
        }));
      },
      onToolResult: () => {
        set((state) => ({
          streamingState: {
            ...state.streamingState,
            activeTool: null,
          },
        }));
      },
      onDone: (sessionId) => {
        if (sessionId && conversationId) {
          setSessionId(get, set, conversationId, sessionId);
        }
        finalizeStreaming(get, set);
      },
      onError: (err) => {
        set({ error: err });
        finalizeStreaming(get, set);
      },
    }
  );

  set({
    streamingState: {
      ...initialStreamingState,
      isStreaming: true,
    },
    abortStream: abort,
    error: null,
  });
}

function addMessage(
  _get: () => ChatStore,
  set: (
    partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)
  ) => void,
  conversationId: string,
  message: ChatMessage
) {
  set((state) => {
    const conversation = state.conversations.get(conversationId);
    if (!conversation) return state;

    const updated: Conversation = {
      ...conversation,
      messages: [...conversation.messages, message],
      updatedAt: new Date().toISOString(),
    };

    const newConversations = new Map(state.conversations);
    newConversations.set(conversationId, updated);
    return { conversations: newConversations };
  });
}

function setSessionId(
  _get: () => ChatStore,
  set: (
    partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)
  ) => void,
  conversationId: string,
  sessionId: string
) {
  set((state) => {
    const conversation = state.conversations.get(conversationId);
    if (!conversation) return state;

    const updated: Conversation = {
      ...conversation,
      sessionId,
      updatedAt: new Date().toISOString(),
    };

    const newConversations = new Map(state.conversations);
    newConversations.set(conversationId, updated);
    return { conversations: newConversations };
  });
}

function finalizeStreaming(
  get: () => ChatStore,
  set: (
    partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)
  ) => void
) {
  const { streamingState, activeConversationId } = get();
  if (activeConversationId && streamingState.currentText) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: streamingState.currentText,
      thinking: streamingState.currentThinking ?? undefined,
      timestamp: new Date().toISOString(),
    };
    addMessage(get, set, activeConversationId, message);
  }

  set({
    streamingState: { ...initialStreamingState },
    abortStream: null,
  });
}
