import {
  AlertCircle,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Send,
  Square,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { SidebarHeader } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useChatStore } from "../store/chatStore";

interface ChatPanelProps {
  workingDirectory?: string;
  className?: string;
  isVisible?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export function ChatPanel({
  workingDirectory,
  className,
  isVisible,
  isExpanded,
  onToggleExpanded,
}: ChatPanelProps) {
  const streamingState = useChatStore((s) => s.streamingState);
  const claudeStatus = useChatStore((s) => s.claudeStatus);
  const isCheckingStatus = useChatStore((s) => s.isCheckingStatus);
  const error = useChatStore((s) => s.error);
  const getActiveConversation = useChatStore((s) => s.getActiveConversation);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendDailySummary = useChatStore((s) => s.sendDailySummary);
  const cancelStreaming = useChatStore((s) => s.cancelStreaming);
  const createConversation = useChatStore((s) => s.createConversation);
  const setError = useChatStore((s) => s.setError);
  const checkClaudeStatus = useChatStore((s) => s.checkClaudeStatus);

  const messages = getActiveConversation()?.messages ?? [];

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check Claude CLI status on mount
  useEffect(() => {
    void checkClaudeStatus();
  }, [checkClaudeStatus]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingState.currentText]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Auto-focus textarea when panel becomes visible
  useEffect(() => {
    if (isVisible) {
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea && !textarea.disabled) {
          textarea.focus();
        }
      });
    }
  }, [isVisible]);

  const handleSubmit = () => {
    if (!input.trim() || streamingState.isStreaming) return;
    sendMessage(input, workingDirectory);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isUnavailable = claudeStatus === "unavailable";
  const isLoading = isCheckingStatus || claudeStatus === "checking";
  const isDailySummaryDisabled =
    isUnavailable || isLoading || streamingState.isStreaming;

  return (
    <div
      className={cn(
        "relative flex flex-col h-full bg-background overflow-hidden w-full",
        className
      )}
    >
      <SidebarHeader className="border-b px-3 py-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Chat</span>
            {isLoading && <Loader size={14} />}
            {isUnavailable && (
              <span className="text-xs text-destructive">CLI unavailable</span>
            )}
          </div>
          <ButtonGroup>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Expand Panel"
              onClick={onToggleExpanded}
            >
              {isExpanded ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => sendDailySummary(workingDirectory)}
              disabled={isDailySummaryDisabled}
              title="Daily Summary"
            >
              <ClipboardList className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={createConversation}
              title="New conversation"
            >
              <Plus className="size-4" />
            </Button>
          </ButtonGroup>
        </div>
      </SidebarHeader>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm bg-destructive/10 text-destructive shrink-0">
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1 truncate">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="h-auto py-0.5 px-1"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Claude CLI Installation Guide */}
      {isUnavailable && !error && (
        <div className="px-4 py-3 text-sm bg-muted shrink-0">
          <p className="font-medium mb-1">Claude CLI is not installed</p>
          <p className="text-muted-foreground text-xs">
            Install Claude CLI to use the chat feature. Visit{" "}
            <a
              href="https://docs.anthropic.com/en/docs/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Claude Code docs
            </a>{" "}
            for installation instructions.
          </p>
        </div>
      )}

      {/* Messages Area - scrollable with padding for fixed input */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-[72px]">
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 && !streamingState.isStreaming && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Start a conversation with Claude
            </div>
          )}

          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                {message.thinking && (
                  <Reasoning defaultOpen={false}>
                    <ReasoningTrigger />
                    <ReasoningContent>{message.thinking}</ReasoningContent>
                  </Reasoning>
                )}
                <MessageResponse>{message.content}</MessageResponse>
                {message.toolUse?.map((tool) => (
                  <Tool key={tool.id} defaultOpen={false}>
                    <ToolHeader
                      title={tool.name}
                      type="tool-invocation"
                      state={
                        tool.result ? "output-available" : "input-available"
                      }
                    />
                    <ToolContent>
                      <ToolInput input={tool.input} />
                    </ToolContent>
                  </Tool>
                ))}
              </MessageContent>
            </Message>
          ))}

          {/* Streaming state */}
          {streamingState.isStreaming && (
            <Message from="assistant">
              <MessageContent>
                {streamingState.currentThinking && (
                  <Reasoning isStreaming defaultOpen>
                    <ReasoningTrigger />
                    <ReasoningContent>
                      {streamingState.currentThinking}
                    </ReasoningContent>
                  </Reasoning>
                )}
                {streamingState.activeTool && (
                  <Tool defaultOpen>
                    <ToolHeader
                      title={streamingState.activeTool.name}
                      type="tool-invocation"
                      state="input-available"
                    />
                    <ToolContent>
                      <ToolInput input={streamingState.activeTool.input} />
                    </ToolContent>
                  </Tool>
                )}
                {streamingState.currentText && (
                  <MessageResponse>
                    {streamingState.currentText}
                  </MessageResponse>
                )}
                {!streamingState.currentText &&
                  !streamingState.currentThinking &&
                  !streamingState.activeTool && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader size={14} />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  )}
              </MessageContent>
            </Message>
          )}
        </div>
      </div>

      {/* Input Area - fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 border-t p-3 bg-background">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isUnavailable
                ? "Claude CLI is not available"
                : "Type a message..."
            }
            disabled={isUnavailable || streamingState.isStreaming}
            className={cn(
              "flex-1 resize-none rounded-md border bg-background px-3 py-2",
              "text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "min-h-[40px] max-h-[200px]"
            )}
            rows={1}
          />
          {streamingState.isStreaming ? (
            <Button
              variant="destructive"
              size="icon"
              onClick={cancelStreaming}
              title="Stop generating"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!input.trim() || isUnavailable}
              title="Send message"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
