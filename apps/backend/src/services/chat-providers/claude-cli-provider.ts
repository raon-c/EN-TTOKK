import {
  cancelRequest,
  checkClaudeCliStatus,
  sendMessage,
  streamMessage,
} from "../claude-cli";
import type {
  ChatProvider,
  SendMessageInput,
  StreamMessageInput,
} from "./types";

const sendClaudeMessage = async (input: SendMessageInput) =>
  sendMessage({
    message: input.message,
    workingDirectory: input.workingDirectory,
    sessionId: input.sessionId,
    systemPrompt: input.systemPrompt,
  });

const streamClaudeMessage = (input: StreamMessageInput) =>
  streamMessage({
    message: input.message,
    workingDirectory: input.workingDirectory,
    sessionId: input.sessionId,
    systemPrompt: input.systemPrompt,
    requestId: input.requestId,
  });

export const claudeCliProvider: ChatProvider = {
  name: "claude-cli",
  checkStatus: checkClaudeCliStatus,
  sendMessage: sendClaudeMessage,
  streamMessage: streamClaudeMessage,
  cancelRequest,
};
