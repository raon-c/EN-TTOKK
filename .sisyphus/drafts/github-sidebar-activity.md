# Draft: GitHub Sidebar Activity

## Requirements (confirmed)
- Connect GitHub via the gh CLI from the right sidebar.
- Show a calendar at the top (like Google Calendar/Jira).
- Fetch activity for the selected date.
- Display GitHub activity types: commits, PRs created, code reviews, comments.

## Technical Decisions
- (pending)

## Research Findings
- Sidebar patterns live in:
  - /Users/raon.c/Desktop/Development/bun-enttokk/apps/desktop-app/src/components/ui/sidebar.tsx
  - /Users/raon.c/Desktop/Development/bun-enttokk/apps/desktop-app/src/layouts/EditorLayout.tsx
  - /Users/raon.c/Desktop/Development/bun-enttokk/apps/desktop-app/src/features/vault/components/FileExplorer.tsx
- Calendar/date-selection patterns live in:
  - /Users/raon.c/Desktop/Development/bun-enttokk/apps/desktop-app/src/components/ui/calendar.tsx
  - /Users/raon.c/Desktop/Development/bun-enttokk/apps/desktop-app/src/features/google-calendar/components/GoogleCalendarPanel.tsx
  - /Users/raon.c/Desktop/Development/bun-enttokk/apps/desktop-app/src/features/jira/components/JiraPanel.tsx
  - /Users/raon.c/Desktop/Development/bun-enttokk/apps/desktop-app/src/features/daily-notes/components/DailyNotesCalendar.tsx
  - Day markers: CalendarDayWithEventDot.tsx, CalendarDayWithDot.tsx
- Date utilities and store patterns:
  - /Users/raon.c/Desktop/Development/bun-enttokk/apps/desktop-app/src/features/google-calendar/utils/dates.ts
  - /Users/raon.c/Desktop/Development/bun-enttokk/apps/desktop-app/src/features/google-calendar/store/googleCalendarStore.ts
- Test infrastructure:
  - Backend uses Bun test (apps/backend/package.json -> "test": "bun test")
  - Example tests in /Users/raon.c/Desktop/Development/bun-enttokk/apps/backend/tests/*.test.ts
  - No Jest/Vitest config found; desktop-app has no test script

## Open Questions
- What GitHub scope should the sidebar pull from (all accessible repos vs selected orgs/repos)?
- Which gh auth model should be used (existing user session vs app-managed token)?
- Timezone handling for date selection and activity grouping.
- Any filtering, limits, or pagination requirements.
- Offline caching or refresh behavior expectations.
- Test strategy for desktop-app changes (TDD, tests-after, or manual-only).

## Scope Boundaries
- INCLUDE: right sidebar GitHub activity view with calendar-based date selection.
- EXCLUDE: (pending confirmation)
