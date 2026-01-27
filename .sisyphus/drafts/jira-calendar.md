# Draft: Jira Calendar Filter

## Requirements (confirmed)
- Improve the Jira area with a top calendar (Google Calendar-like) so selecting a date shows only issues for that date.

## Technical Decisions
- Filter issues by updated date.
- Date selection is single-day.
- Issues without a date are hidden by default.

## Research Findings
- Existing calendar UI component: `apps/desktop-app/src/components/ui/calendar.tsx`.
- Calendar usage examples: `apps/desktop-app/src/features/google-calendar/components/GoogleCalendarPanel.tsx`, `apps/desktop-app/src/features/daily-notes/components/DailyNotesCalendar.tsx`.
- Right sidebar already has Calendar/Google Calendar/Jira tabs: `apps/desktop-app/src/layouts/EditorLayout.tsx`.

## Open Questions
- (pending) Test strategy decision (after test infra check).
- Any explicit exclusions for the Jira area update?

## Scope Boundaries
- INCLUDE: Calendar UI at the top of the Jira area; date-based filtering of the issue list.
- EXCLUDE: (pending)
