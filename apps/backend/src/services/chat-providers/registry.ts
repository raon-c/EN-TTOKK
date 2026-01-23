import { claudeCliProvider } from "./claude-cli-provider";
import type { ChatProvider } from "./types";

const DEFAULT_PROVIDER_NAME = "claude-cli";

const providers: Record<string, ChatProvider> = {
  [claudeCliProvider.name]: claudeCliProvider,
};

const resolveProviderName = (requested?: string) => {
  const fallback = process.env.CHAT_PROVIDER ?? DEFAULT_PROVIDER_NAME;
  const candidate = requested ?? fallback;
  return providers[candidate] ? candidate : DEFAULT_PROVIDER_NAME;
};

export const getChatProvider = (requested?: string) =>
  providers[resolveProviderName(requested)];

export const listChatProviders = () => Object.keys(providers);
