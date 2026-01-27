import type {
  JiraIssue,
  JiraIssuesResponse,
  JiraTestRequest,
  JiraTestResponse,
  JiraUserProfile,
} from "@enttokk/api-types";
import { create } from "zustand";

import { apiClient } from "@/lib/api-client";
import {
  getJiraToken,
  removeJiraToken,
  setJiraToken,
} from "@/lib/secure-store";
import { getValue, setValue } from "@/lib/tauri-store";

import type { JiraStatus, JiraStoredState } from "../types";

const STORAGE_KEY = "jiraIntegration";

type JiraStoreState = {
  status: JiraStatus;
  error: string | null;
  baseUrl: string;
  email: string;
  apiToken: string;
  profile: JiraUserProfile | null;
  lastCheckedAt: number | null;
  issues: JiraIssue[];
  isLoadingIssues: boolean;
  hasStoredToken: boolean;

  setBaseUrl: (value: string) => void;
  setEmail: (value: string) => void;
  setApiToken: (value: string) => void;

  loadFromStore: () => Promise<void>;
  save: () => Promise<void>;
  testConnection: () => Promise<void>;
  fetchIssues: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const normalizeUrl = (value: string) => value.trim().replace(/\/$/, "");

const buildStoredState = (state: JiraStoreState): JiraStoredState => ({
  baseUrl: normalizeUrl(state.baseUrl),
  email: state.email.trim(),
  profile: state.profile ?? undefined,
  lastCheckedAt: state.lastCheckedAt ?? undefined,
});

const hasCredentials = (request: JiraTestRequest) =>
  Boolean(request.baseUrl && request.email && request.apiToken);

const resolveToken = async (state: JiraStoreState) => {
  const token = state.apiToken.trim();
  if (token) return token;
  try {
    const stored = await getJiraToken();
    return stored?.trim() ?? "";
  } catch {
    return "";
  }
};

export const useJiraStore = create<JiraStoreState>((set, get) => ({
  status: "disconnected",
  error: null,
  baseUrl: "",
  email: "",
  apiToken: "",
  profile: null,
  lastCheckedAt: null,
  issues: [],
  isLoadingIssues: false,
  hasStoredToken: false,

  setBaseUrl: (value) => set({ baseUrl: value, error: null }),
  setEmail: (value) => set({ email: value, error: null }),
  setApiToken: (value) => set({ apiToken: value, error: null }),

  loadFromStore: async () => {
    const stored = await getValue<JiraStoredState>(STORAGE_KEY);
    if (!stored) return;
    let token: string | null = null;
    try {
      token = await getJiraToken();
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to access secure storage",
      });
    }
    set({
      baseUrl: stored.baseUrl ?? "",
      email: stored.email ?? "",
      apiToken: "",
      profile: stored.profile ?? null,
      lastCheckedAt: stored.lastCheckedAt ?? null,
      hasStoredToken: Boolean(token?.trim()),
      status: token ? "connected" : "disconnected",
    });
    if (token) {
      await get().fetchIssues();
    }
  },

  save: async () => {
    const state = get();
    await setValue(STORAGE_KEY, buildStoredState(state));
    const trimmedToken = state.apiToken.trim();
    try {
      if (trimmedToken) {
        await setJiraToken(trimmedToken);
        set({ apiToken: "", hasStoredToken: true });
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to update secure storage",
      });
    }
  },

  testConnection: async () => {
    const state = get();
    const apiToken = await resolveToken(state);
    const request: JiraTestRequest = {
      baseUrl: normalizeUrl(state.baseUrl),
      email: state.email.trim(),
      apiToken,
    };
    if (!hasCredentials(request)) {
      set({
        status: "error",
        error: "Base URL, email, and API token are required.",
      });
      return;
    }

    set({ status: "connecting", error: null });
    try {
      const response: JiraTestResponse =
        await apiClient.jira.testConnection(request);
      set({
        status: "connected",
        profile: response.profile ?? null,
        lastCheckedAt: Date.now(),
        error: null,
      });
      await get().save();
      await get().fetchIssues();
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "Jira test failed",
        profile: null,
        lastCheckedAt: null,
        issues: [],
      });
      await get().save();
    }
  },

  fetchIssues: async () => {
    const state = get();
    const apiToken = await resolveToken(state);
    const request: JiraTestRequest = {
      baseUrl: normalizeUrl(state.baseUrl),
      email: state.email.trim(),
      apiToken,
    };
    if (!hasCredentials(request)) {
      set({
        status: "error",
        error: "Base URL, email, and API token are required.",
      });
      return;
    }

    set({ isLoadingIssues: true, error: null });
    try {
      const response: JiraIssuesResponse =
        await apiClient.jira.listIssues(request);
      set({
        status: "connected",
        issues: response.issues ?? [],
        error: null,
      });
    } catch (error) {
      set({
        issues: [],
        error: error instanceof Error ? error.message : "Jira issues failed",
      });
    } finally {
      set({ isLoadingIssues: false });
    }
  },

  disconnect: async () => {
    set({
      status: "disconnected",
      error: null,
      baseUrl: "",
      email: "",
      apiToken: "",
      profile: null,
      lastCheckedAt: null,
      issues: [],
      isLoadingIssues: false,
      hasStoredToken: false,
    });
    await setValue(STORAGE_KEY, null);
    try {
      await removeJiraToken();
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to clear secure storage",
      });
    }
  },
}));
