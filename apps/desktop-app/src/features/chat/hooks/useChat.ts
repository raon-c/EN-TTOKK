import type { ChatMessage } from "@enttokk/api-types";
import { useCallback, useEffect } from "react";
import { buildDailySummaryPrompt } from "@/features/daily-summary/buildDailySummaryPrompt";
import { apiClient } from "@/lib/api-client";
import { useChatStore } from "../store/chatStore";

export function useChat() {
  const {
    conversations,
    activeConversationId,
    streamingState,
    claudeStatus,
    isCheckingStatus,
    error,
    setClaudeStatus,
    setIsCheckingStatus,
    setError,
    createConversation,
    setActiveConversation,
    addMessage,
    setSessionId,
    getActiveConversation,
    getActiveSessionId,
    startStreaming,
    appendStreamingText,
    setStreamingThinking,
    setStreamingTool,
    finalizeStreaming,
    cancelStreaming,
  } = useChatStore();

  // Check Claude CLI status on mount
  useEffect(() => {
    const checkStatus = async () => {
      setIsCheckingStatus(true);
      try {
        const status = await apiClient.chat.checkStatus();
        setClaudeStatus(status.status);
        if (status.status === "unavailable") {
          setError(status.error ?? "Claude CLI is not available");
        }
      } catch (err) {
        setClaudeStatus("unavailable");
        setError(
          err instanceof Error
            ? err.message
            : "Failed to check Claude CLI status"
        );
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkStatus();
  }, [setClaudeStatus, setIsCheckingStatus, setError]);

  const sendStreamingMessage = useCallback(
    async (params: {
      requestMessage: string;
      displayMessage?: string;
      workingDirectory?: string;
    }) => {
      if (!params.requestMessage.trim()) return;
      if (claudeStatus !== "available") {
        setError("Claude CLI is not available");
        return;
      }

      // Create conversation if none exists
      let conversationId = activeConversationId;
      if (!conversationId) {
        conversationId = createConversation();
      }

      // Get the current session ID for context persistence
      const currentSessionId = getActiveSessionId();

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: (params.displayMessage ?? params.requestMessage).trim(),
        timestamp: new Date().toISOString(),
      };
      addMessage(conversationId, userMessage);

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
            // Store session ID when received for context persistence
            if (sessionId && conversationId) {
              setSessionId(conversationId, sessionId);
            }
          },
          onTextDelta: (text) => {
            appendStreamingText(text);
          },
          onThinking: (thinking) => {
            setStreamingThinking(thinking);
          },
          onToolUse: (tool) => {
            setStreamingTool(tool);
          },
          onToolResult: () => {
            setStreamingTool(null);
          },
          onDone: (sessionId) => {
            // Also store session ID from done event if not already stored
            if (sessionId && conversationId) {
              setSessionId(conversationId, sessionId);
            }
            finalizeStreaming();
          },
          onError: (err) => {
            setError(err);
            finalizeStreaming();
          },
        }
      );

      startStreaming(abort);
    },
    [
      activeConversationId,
      claudeStatus,
      createConversation,
      addMessage,
      setSessionId,
      getActiveSessionId,
      startStreaming,
      appendStreamingText,
      setStreamingThinking,
      setStreamingTool,
      finalizeStreaming,
      setError,
    ]
  );

  // Send a message with streaming
  const sendMessage = useCallback(
    async (content: string, workingDirectory?: string) => {
      await sendStreamingMessage({
        requestMessage: content,
        displayMessage: content,
        workingDirectory,
      });
    },
    [sendStreamingMessage]
  );

  const sendDailySummary = useCallback(
    async (workingDirectory?: string) => {
      try {
        const request = await buildDailySummaryPrompt();
        await sendStreamingMessage({
          requestMessage: request.requestMessage,
          displayMessage: request.displayMessage,
          workingDirectory,
        });
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to build daily summary"
        );
      }
    },
    [sendStreamingMessage, setError]
  );

  // Get messages for active conversation
  const messages = getActiveConversation()?.messages ?? [];

  // Start a new conversation
  const newConversation = useCallback(() => {
    createConversation();
  }, [createConversation]);

  return {
    // State
    messages,
    activeConversationId,
    conversations: Array.from(conversations.values()),
    streamingState,
    claudeStatus,
    isCheckingStatus,
    error,

    // Actions
    sendMessage,
    sendDailySummary,
    cancelStreaming,
    newConversation,
    setActiveConversation,
    clearError: () => setError(null),
  };
}
