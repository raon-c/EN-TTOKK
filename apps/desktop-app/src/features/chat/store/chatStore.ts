import type { ChatMessage, ClaudeCliStatus } from "@enttokk/api-types";
import { create } from "zustand";

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
  sessionId: string | null; // Claude CLI session ID for context persistence
  createdAt: string;
  updatedAt: string;
}

interface ChatStore {
  // Conversations
  conversations: Map<string, Conversation>;
  activeConversationId: string | null;

  // Streaming state
  streamingState: StreamingState;

  // Claude CLI status
  claudeStatus: ClaudeCliStatus;

  // Loading/error states
  isCheckingStatus: boolean;
  error: string | null;

  // Abort controller for cancellation
  abortStream: (() => void) | null;

  // Actions
  setClaudeStatus: (status: ClaudeCliStatus) => void;
  setIsCheckingStatus: (isChecking: boolean) => void;
  setError: (error: string | null) => void;

  // Conversation actions
  createConversation: () => string;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  setSessionId: (conversationId: string, sessionId: string) => void;
  getActiveConversation: () => Conversation | null;
  getActiveSessionId: () => string | null;

  // Streaming actions
  startStreaming: (abort: () => void) => void;
  appendStreamingText: (text: string) => void;
  setStreamingThinking: (thinking: string | null) => void;
  setStreamingTool: (tool: ActiveTool | null) => void;
  finalizeStreaming: () => ChatMessage | null;
  cancelStreaming: () => void;
  resetStreamingState: () => void;
}

const initialStreamingState: StreamingState = {
  isStreaming: false,
  currentText: "",
  currentThinking: null,
  activeTool: null,
};

export const useChatStore = create<ChatStore>()((set, get) => ({
  // Initial state
  conversations: new Map(),
  activeConversationId: null,
  streamingState: { ...initialStreamingState },
  claudeStatus: "checking",
  isCheckingStatus: false,
  error: null,
  abortStream: null,

  // Status actions
  setClaudeStatus: (status) => set({ claudeStatus: status }),
  setIsCheckingStatus: (isChecking) => set({ isCheckingStatus: isChecking }),
  setError: (error) => set({ error }),

  // Conversation actions
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

  addMessage: (conversationId, message) => {
    set((state) => {
      const conversation = state.conversations.get(conversationId);
      if (!conversation) return state;

      const updatedConversation: Conversation = {
        ...conversation,
        messages: [...conversation.messages, message],
        updatedAt: new Date().toISOString(),
      };

      const newConversations = new Map(state.conversations);
      newConversations.set(conversationId, updatedConversation);

      return { conversations: newConversations };
    });
  },

  setSessionId: (conversationId, sessionId) => {
    set((state) => {
      const conversation = state.conversations.get(conversationId);
      if (!conversation) return state;

      const updatedConversation: Conversation = {
        ...conversation,
        sessionId,
        updatedAt: new Date().toISOString(),
      };

      const newConversations = new Map(state.conversations);
      newConversations.set(conversationId, updatedConversation);

      return { conversations: newConversations };
    });
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    if (!activeConversationId) return null;
    return conversations.get(activeConversationId) ?? null;
  },

  getActiveSessionId: () => {
    const conversation = get().getActiveConversation();
    return conversation?.sessionId ?? null;
  },

  // Streaming actions
  startStreaming: (abort) => {
    set({
      streamingState: {
        ...initialStreamingState,
        isStreaming: true,
      },
      abortStream: abort,
      error: null,
    });
  },

  appendStreamingText: (text) => {
    set((state) => ({
      streamingState: {
        ...state.streamingState,
        currentText: state.streamingState.currentText + text,
      },
    }));
  },

  setStreamingThinking: (thinking) => {
    set((state) => ({
      streamingState: {
        ...state.streamingState,
        currentThinking: thinking,
      },
    }));
  },

  setStreamingTool: (tool) => {
    set((state) => ({
      streamingState: {
        ...state.streamingState,
        activeTool: tool,
      },
    }));
  },

  finalizeStreaming: () => {
    const { streamingState, activeConversationId } = get();
    if (!activeConversationId || !streamingState.currentText) {
      get().resetStreamingState();
      return null;
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: streamingState.currentText,
      thinking: streamingState.currentThinking ?? undefined,
      timestamp: new Date().toISOString(),
    };

    get().addMessage(activeConversationId, message);
    get().resetStreamingState();

    return message;
  },

  cancelStreaming: () => {
    const { abortStream } = get();
    if (abortStream) {
      abortStream();
    }
    get().resetStreamingState();
  },

  resetStreamingState: () => {
    set({
      streamingState: { ...initialStreamingState },
      abortStream: null,
    });
  },
}));
