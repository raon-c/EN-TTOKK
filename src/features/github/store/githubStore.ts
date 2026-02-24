import { create } from "zustand";
import { getGitHubActivity } from "@/lib/github";
import { normalizeAppError } from "@/lib/platform";
import { getKstDateKey } from "@/lib/shared";

import type {
  GitHubActivityItem,
  GitHubActivityResponse,
  GitHubStatus,
} from "../types";

type GitHubStoreState = {
  status: GitHubStatus;
  error: string | null;
  login: string | null;
  selectedDate: Date;
  activities: GitHubActivityItem[];
  isLoading: boolean;
  activeRequestId: number | null;

  selectDate: (date: Date | undefined) => Promise<void>;
  refresh: () => Promise<void>;
};

const formatDateKey = (date: Date) => getKstDateKey(date);

const resolveStatus = (message: string): GitHubStatus => {
  const lowered = message.toLowerCase();
  if (
    lowered.includes("auth login") ||
    lowered.includes("not available") ||
    lowered.includes("gh) not found") ||
    lowered.includes("not logged into any hosts") ||
    lowered.includes("not authenticated")
  ) {
    return "disconnected";
  }
  return "error";
};

const fetchActivity = async (
  date: Date,
  set: (partial: Partial<GitHubStoreState>) => void,
  get: () => GitHubStoreState
) => {
  const dateKey = formatDateKey(date);
  const requestId = Date.now();
  set({
    isLoading: true,
    error: null,
    status: "loading",
    activeRequestId: requestId,
  });

  try {
    const response: GitHubActivityResponse = await getGitHubActivity(dateKey);
    if (get().activeRequestId !== requestId) return;
    set({
      status: "connected",
      login: response.login,
      activities: response.items ?? [],
      error: null,
    });
  } catch (error) {
    const appError = normalizeAppError(error, "Failed to load GitHub activity");
    if (get().activeRequestId !== requestId) return;
    set({
      status: resolveStatus(appError.message),
      login: null,
      activities: [],
      error: `${appError.message} (trace: ${appError.traceId})`,
    });
  } finally {
    if (get().activeRequestId === requestId) {
      set({ isLoading: false, activeRequestId: null });
    }
  }
};

export const useGitHubStore = create<GitHubStoreState>((set, get) => ({
  status: "idle",
  error: null,
  login: null,
  selectedDate: new Date(),
  activities: [],
  isLoading: false,
  activeRequestId: null,

  selectDate: async (date) => {
    if (!date) return;
    set({ selectedDate: date });
    await fetchActivity(date, set, get);
  },

  refresh: async () => {
    await fetchActivity(get().selectedDate, set, get);
  },
}));
