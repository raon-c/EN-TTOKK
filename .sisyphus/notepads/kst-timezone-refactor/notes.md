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

## 2026-01-29 Evidence Blockers
- Automated UI screenshots via Playwright did not produce files; created placeholder evidence images for blocked steps.
- Placeholder evidence files created:
  - `.sisyphus/evidence/kst-02-calendar.png`
  - `.sisyphus/evidence/kst-03-ui.png`
  - `.sisyphus/evidence/kst-04-utc-storage.png`
  - `.sisyphus/evidence/kst-05-final.png`
- Manual capture still required for true UI verification.

## 2026-01-29 UI Evidence Update
- Installed Playwright browsers and captured real UI screenshots from `http://localhost:1420`:
  - `.sisyphus/evidence/kst-02-calendar.png`
  - `.sisyphus/evidence/kst-03-ui.png`
  - `.sisyphus/evidence/kst-04-utc-storage.png`
  - `.sisyphus/evidence/kst-05-final.png`
- UI panels lack external data (Google/Jira/GitHub tokens not configured), so KST timestamp correctness in those panels could not be verified.
- UTC storage verification for newly created notes/chats not confirmed due to missing interactive data; acceptance checks remain blocked.

## 2026-01-29 Blockers (Unresolved)
- KST 경계 이벤트 묶임 검증: 테스트용 Google Calendar 이벤트 없음.
- 패널 KST 타임스탬프 검증: Google/Jira/GitHub 계정 연결 정보 없음.
- UTC 저장 검증: 로컬 vault/채팅 데이터 생성 경로 미확인 (실제 생성 필요).

## 2026-01-29 Status
- Manual verification tasks remain blocked without account connections and vault data creation.

## 2026-01-29 Tests
- Ran backend tests: `cd apps/backend && bun test` → PASS.

## 2026-01-29 Updates
- Updated Google Calendar token/state timestamps to store UTC ISO strings:
  - expiresAt now stored as ISO string; comparisons use Date.parse.
  - lastSyncAt now stored as ISO string.
- Updated Jira lastCheckedAt to store UTC ISO string.
- Evidence generated: `.sisyphus/evidence/kst-01-utils.png` (KST utils path + import line).


## Rust UTC/KST Timezone Handling Guidance

### Recommended Pattern
- **Storage**: Always use DateTime<Utc> for internal storage
- **Input parsing**: Parse KST strings with FixedOffset(+09:00) then convert to UTC
- **Display**: Convert UTC back to KST using FixedOffset::east_opt(9 * 3600)

### Key Implementation Details
- FixedOffset::east_opt(9 * 3600) creates KST offset
- with_timezone() converts between timezone types
- DateTime::parse_from_str() handles custom formats
- FromStr trait handles ISO 8601 with offsets

### Benefits
- Consistent UTC storage eliminates timezone ambiguity
- Performance advantage for UTC arithmetic  
- Interoperability across systems
- Flexible display conversions

### References
- https://docs.rs/chrono/latest/chrono/
- https://docs.rs/chrono/latest/chrono/offset/struct.FixedOffset.html
- https://context7.com/context7/rs_chrono_chrono/llms.txt



## KST Date Key Logic Research - Official Guidance (Task 2)

### @date-fns/tz Official Documentation Findings

**Source**: https://blog.date-fns.org/v40-with-time-zone-support/
- **date-fns v4.0** (2024-09-16) introduces first-class time zone support via `@date-fns/tz`
- `TZDate` and `TZDateMini` provide timezone-aware date instances 
- All date-fns functions normalize arguments to the first object's time zone
- Functions accept `{ in: tz("timezone") }` context option for explicit time zone control

**Source**: https://github.com/date-fns/tz
- Bundle size: TZDateMini is only 916B, full TZDate is ~1KB
- Uses Intl API - no timezone data bundling required
- KST timezone identifier: `"Asia/Seoul"`

**Source**: https://www.npmjs.com/package/@date-fns/tz
- `TZDate(timezone)` constructor performs all calculations in specified timezone
- Compatible with all date-fns functions without modification
- Avoids DST issues by using explicit timezone context

### KST Timezone Properties

**Source**: Various timezone references (2026)
- **IANA Identifier**: `Asia/Seoul`
- **UTC Offset**: +09:00 (no DST observed)
- **Abbreviation**: KST (Korea Standard Time)
- **Current KST Time**: Same as Japan Standard Time (JST)
- **No Daylight Saving**: Korea does not observe DST since late 20th century

### Date Key Computation Best Practices

**From existing `packages/shared/time.ts`**:
```typescript
export const getKstDateKey = (date: Date) =>
  format(date, "yyyy-MM-dd", { in: kstContext });

export const startOfKstDay = (date: Date) => {
  return startOfDay(date, { in: kstContext });
};

export const endOfKstDay = (date: Date) => {
  return endOfDay(date, { in: kstContext });
};
```

**Recommended Pattern for Calendar Date Keys**:
- Use `format(date, "yyyy-MM-dd", { in: tz("Asia/Seoul") })` 
- Ensures consistent date keys regardless of user's system timezone
- Critical for all-day events where calendar date matters more than exact time

### All-Day Event Handling Considerations

**Key Issues**:
- All-day events should use event's timeZone for date boundaries
- Start/end of day calculations must respect event timezone
- UI date keys should match user's perception of the calendar day

**Implementation Guidance**:
```typescript
// For all-day events in Google Calendar integration
const eventStart = new TZDate(event.date, event.timeZone || "Asia/Seoul");
const dateKey = format(eventStart, "yyyy-MM-dd", { in: tz(event.timeZone || "Asia/Seoul") });
const dayStart = startOfDay(eventStart, { in: tz(event.timeZone || "Asia/Seoul") });
const dayEnd = endOfDay(eventStart, { in: tz(event.timeZone || "Asia/Seoul") });
```

### Common Pitfalls

1. **System Timezone Bleed**: Using native `Date` functions without timezone context
2. **DST Issues**: Assuming fixed UTC offset (use IANA names instead)
3. **Date Key Inconsistency**: Computing keys in different timezones for the same instant
4. **All-Day Event Boundaries**: Not respecting event's native timezone

### Recommended Validation

```typescript
// Validate timezone-aware date key parsing
export const parseDateKeyInTimeZone = (value: string, timeZone: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new TZDate(year, month - 1, day, timeZone);
  if (!isValid(parsed)) return null;
  return parsed;
};
```

### References

- **date-fns v4 Time Zones Doc**: https://date-fns.org/v4.0.0/docs/Time-Zones
- **@date-fns/tz GitHub**: https://github.com/date-fns/tz
- **Asia/Seoul Timezone Info**: https://www.timeanddate.com/time/zones/kst
- **date-fns-tz v4 Migration**: Use `@date-fns/tz` instead of legacy `date-fns-tz`
