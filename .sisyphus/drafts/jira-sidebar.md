# Draft: JIRA Sidebar Integration

## Requirements (confirmed)
- "우측 사이드바에 JIRA 연동, 유저가 직접 API 키를 입력."
- Reference link provided: https://opncd.ai/share/yAaLxE5S (content not yet accessible)

## Technical Decisions
- Target: Jira Cloud
- User inputs: Site URL + Email + API key (API token)
- Storage: API token kept in memory only; base URL + email persisted in tauri-store
- Sidebar UX: Connect + status (save/test, show connection state)
- Test strategy: Add test setup, then add tests after implementation

## Research Findings
- Right sidebar is implemented in `apps/desktop-app/src/layouts/EditorLayout.tsx` with a `SidebarProvider` and `Sidebar side="right"`; content panels are swapped by `rightSidebarTab`.
- Sidebar slot components live in `apps/desktop-app/src/components/ui/sidebar.tsx` (e.g., `SidebarContent`, `SidebarHeader`, `SidebarFooter`, `SidebarGroup`).
- Existing integration panel pattern: `apps/desktop-app/src/features/google-calendar/components/GoogleCalendarPanel.tsx` uses `SidebarContent`, connect/disconnect actions, status/error display, and a header action row.
- Settings UX pattern: `apps/desktop-app/src/features/settings/components/SettingsDialog.tsx` shows connection status with icons and a check action.
- Local settings storage currently uses `@tauri-apps/plugin-store` via `apps/desktop-app/src/lib/tauri-store.ts` and `apps/desktop-app/src/features/settings/store/settingsStore.ts`.
- Test infrastructure appears absent (no test scripts/configs found per repo scan).
- Tauri plugins in use (no secure storage plugin yet): `apps/desktop-app/src-tauri/Cargo.toml` includes `tauri-plugin-store`, `tauri-plugin-opener`, `tauri-plugin-dialog`, `tauri-plugin-shell`.
- Google Calendar tokens are persisted to `tauri-store` via `apps/desktop-app/src/features/google-calendar/store/googleCalendarStore.ts` (stored under key `googleCalendar`).
- Backend integration pattern exists for Google Calendar: `apps/backend/src/routes/google-calendar.ts` provides `/integrations/google/token` and `/integrations/google/events` with validation in `apps/backend/src/lib/validation.ts`.
- Google Calendar config uses Vite env vars in `apps/desktop-app/src/features/google-calendar/config.ts` (`VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_SECRET`) and loopback redirect to backend at `http://127.0.0.1:31337/oauth/google/callback`.
- Google Calendar stored state shape (`tokens`, `calendarId`, `syncToken`, `lastSyncAt`) defined in `apps/desktop-app/src/features/google-calendar/types.ts`.
- Jira Cloud API token auth docs: https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis (Basic auth with `email:api_token`), API reference: https://developer.atlassian.com/cloud/jira/platform/rest/v3
- GitHub usage example of Jira REST v3 with Basic auth: https://github.com/RocketChat/Rocket.Chat/blob/develop/apps/meteor/reporters/jira.ts (uses `Authorization: Basic ...` with `/rest/api/3/issue/...`).
- Atlassian API token management: https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/ (tokens created at https://id.atlassian.com/manage-profile/security/api-tokens; tokens expire by default 1-365 days; can use scopes).
- Basic auth header construction (JS): `Authorization: Basic base64(email:apiToken)` (see Jira auth docs above).
- No Jira-specific code found in repo (no `jira`/`atlassian` matches in source).
- Tauri secure storage options (external): Stronghold plugin recommended by Tauri docs https://v2.tauri.app/plugin/stronghold; Store plugin is unencrypted (https://v2.tauri.app/plugin/store).
- Store usage patterns: `apps/desktop-app/src/features/google-calendar/store/googleCalendarStore.ts` persists tokens/status and uses `status: disconnected|connecting|connected|error` with `connect`/`disconnect` flows; similar store pattern exists for settings/chat/vault.
- Backend/local integration patterns: `apps/desktop-app/src/lib/api-client.ts` uses `http://localhost:31337` endpoints; backend routes validate payloads via Zod in `apps/backend/src/lib/validation.ts`.
- Sidebar composition patterns in left/right panels: `apps/desktop-app/src/features/vault/components/FileExplorer.tsx` uses `SidebarHeader`, `SidebarContent`, `SidebarGroup` structure that can be mirrored in a Jira sidebar panel.
- Chat panel uses a fixed header + error banner + scrollable content + fixed input footer layout: `apps/desktop-app/src/features/chat/components/ChatPanel.tsx` (useful for Jira panel layout ideas).
- Jira backend protections: base URL restricted to `*.atlassian.net`, no path/query/userinfo, `redirect: "error"`, and 8s timeout; backend bound to `127.0.0.1`.
- Jira tests: added Bun tests for schema + route behavior in `apps/backend/tests`.

## Open Questions
- Access to the share link content? (if it contains UI/UX reference)

## Scope Boundaries
- INCLUDE: Right sidebar UI for Jira integration + API key input + connect/status UI
- EXCLUDE: (not specified yet)
