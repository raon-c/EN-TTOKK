import type { JiraUserProfile } from "@/types/api";

export type JiraStatus = "disconnected" | "connecting" | "connected" | "error";

export interface JiraStoredState {
  baseUrl: string;
  email: string;
  profile?: JiraUserProfile;
  lastCheckedAt?: string;
}
