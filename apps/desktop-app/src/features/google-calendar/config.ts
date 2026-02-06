export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET =
  import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "";
export const GOOGLE_REDIRECT_URI =
  "http://127.0.0.1:31337/oauth/google/callback";
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
];

export const DEFAULT_CALENDAR_ID = "primary";
export const SYNC_RANGE_PAST_DAYS = 30;
export const SYNC_RANGE_FUTURE_DAYS = 30;
export const POLL_INTERVAL_MS = 5 * 60 * 1000;
export const AUTH_POLL_INTERVAL_MS = 1000;
export const AUTH_TIMEOUT_MS = 2 * 60 * 1000;
