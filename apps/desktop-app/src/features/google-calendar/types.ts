export interface GoogleCalendarTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
}

export interface GoogleCalendarStoredState {
  tokens: GoogleCalendarTokens | null;
  calendarId: string;
  syncToken?: string | null;
  lastSyncAt?: number | null;
}
