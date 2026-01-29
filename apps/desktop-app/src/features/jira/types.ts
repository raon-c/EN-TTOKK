import type { JiraUserProfile } from "@enttokk/api-types";

export type JiraStatus = "disconnected" | "connecting" | "connected" | "error";

export interface JiraStoredState {
  baseUrl: string;
  email: string;
  profile?: JiraUserProfile;
  lastCheckedAt?: string;
}
