# KST Timezone Refactor Notes

## Session Log
- Started execution with plan `kst-timezone-refactor`.

## Learnings
- Added shared KST utilities in `packages/shared/time.ts` using `@date-fns/tz` and `Intl.DateTimeFormat`.
- Updated frontend date keys and UI formatting to use KST helpers via `@bun-enttokk/shared`.
- Documented backend UTC timestamps with inline comments.
- Swapped Settings dialog backend check time display to KST via shared formatter.
- Converted vault note createdAt/updatedAt to UTC ISO strings.
- Ran `bun install` after adding @date-fns/tz.
- Backend tests pass (`bun test`).
- Google Calendar all-day events now respect event timeZone when deriving day start.
- Added date key parsing validation and timezone-aware parsing helper.

## Blockers
- Manual UI verification and screenshots not run yet (requires app launch + UI capture).
