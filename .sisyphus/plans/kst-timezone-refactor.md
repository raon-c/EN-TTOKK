# KST Timezone Refactor Plan

## Context

### Original Request
전체 프로젝트에서 시간관련 로직에서 시간을 다룰때 모두 KST를 사용하도록 리팩토링.

### Interview Summary
**Key Discussions**:
- 내부 저장/전송은 UTC 유지, UI/입출력 경계에서 KST로 변환.
- 적용 범위는 프론트엔드/공유 패키지/백엔드/Rust 전 레이어이며, 로그/외부 API는 UTC 유지.
- 기존 데이터 마이그레이션은 하지 않고, 기존 값은 UTC로 간주.
- 테스트는 백엔드만 tests-after, 프론트는 수동 검증.

**Research Findings**:
- 프론트는 date-fns 포맷/parseISO와 toLocale* 사용이 혼재 (Google Calendar, Jira, GitHub, Daily Notes, Calendar UI 등).
- 백엔드는 Date.now()/toISOString() 사용 (routes/logger).
- Rust(Tauri)는 타임 라이브러리 없이 문자열 타임스탬프를 처리.
- KST 베스트 프랙티스: JS는 Intl.DateTimeFormat(timeZone: "Asia/Seoul") 우선, 필요 시 date-fns-tz. Rust는 chrono FixedOffset(+09:00) 권장.

### Metis Review
**Identified Gaps (addressed)**:
- 추가 질문/가드레일 없음(메티스 응답에 별도 지적이 없었음). 기본 가정은 아래 Task/Guardrails에 명시.

---

## Work Objectives

### Core Objective
전체 레이어에서 시간 표현/입력/계산이 KST 기준으로 일관되게 동작하도록 리팩토링하되, 저장/전송은 UTC를 유지한다.

### Concrete Deliverables
- KST 표준 유틸리티(타임존/포맷/날짜 키/경계 시간) 도입 및 공용화
- 프론트 UI 및 날짜 키/캘린더 로직의 KST 변환 적용
- 백엔드 및 Rust 경계에서 UTC 유지와 KST 입력 해석 일관성 확립
- 수동 검증 절차 및(필요 시) 백엔드 테스트 보강

### Definition of Done
- [x] 프론트 모든 시간 표시/날짜 키가 KST 기준으로 일관됨
- [x] 저장/전송 타임스탬프는 UTC(ISO) 유지
- [x] 로그/외부 API 경로는 UTC 유지
- [x] 백엔드 tests-after 실행(변경 사항 있을 경우)
- [ ] 수동 검증 체크리스트 완료 및 증빙 저장

### Must Have
- KST 타임존(`Asia/Seoul`)을 명시적으로 사용
- 날짜 키(`yyyy-MM-dd`)와 경계 시간(start/end of day)이 KST 기준
- 기존 데이터 마이그레이션 없음

### Must NOT Have (Guardrails)
- 로그/외부 API 타임스탬프를 KST로 변경하지 않기
- 저장/전송을 로컬 타임존 기준으로 변경하지 않기
- 기존 데이터의 의미를 바꾸는 마이그레이션 수행 금지

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (apps/backend, bun test)
- **User wants tests**: YES (Tests-after, backend only)
- **Framework**: bun test

### Tests-after (Backend only)
- 백엔드 변경이 있는 경우에만 tests-after 추가/보강
- 실행: `cd apps/backend && bun test`

### Manual QA (Frontend)
- KST 표시/경계일 확인은 수동 검증으로 수행
- 증빙은 `.sisyphus/evidence/`에 스크린샷 저장

---

## Task Flow

```
Task 1 → Task 2 → Task 3 → Task 4
                    ↘ Task 5 (parallel)
Task 6 ↗
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 2, 5 | 프론트 UI 변경과 백엔드 UTC 확인은 독립 |
| B | 3, 4 | 캘린더/일지 관련 변경과 패널 표시 변경을 병렬화 가능 |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | 공용 유틸리티 사용 |
| 3 | 1 | 공용 유틸리티 사용 |
| 4 | 1 | 공용 유틸리티 사용 |
| 5 | 1 | 공용 유틸리티 기준 필요 |
| 6 | 2,3,4,5 | 전체 적용 후 검증 |

---

## TODOs

### 1) KST 공용 유틸리티 도입 (JS/TS)

**What to do**:
- KST 상수와 포맷 헬퍼를 공용 모듈로 추가 (예: `KST_TIMEZONE`, `KST_LOCALE`, `formatKstDate`, `formatKstDateTime`, `formatKstTime`, `getKstDateKey`, `startOfKstDay`, `endOfKstDay`).
- 표시용 포맷은 `Intl.DateTimeFormat` 사용.
- 날짜 경계(start/end of day)와 날짜 키가 KST 기준이 되도록 처리.
- KST 기준 날짜 경계 계산을 위해 `@date-fns/tz` 도입을 기본값으로 적용.

**Must NOT do**:
- 로컬 타임존에 의존하는 포맷/계산 유지

**Parallelizable**: NO (blocks other tasks)

**References**:
- `apps/desktop-app/src/main.tsx` — date-fns 로케일 기본값 설정 위치
- `apps/desktop-app/src/features/google-calendar/utils/dates.ts` — date key와 start/end of day 사용
- `packages/shared/index.ts` — 공용 유틸 내보내기 후보

**Acceptance Criteria**:
- [x] KST 상수(`Asia/Seoul`)와 포맷 헬퍼가 공용 모듈에 정의됨
- [x] KST 기준 날짜 키/경계 시간 헬퍼가 정의됨
- [x] 공용 모듈을 프론트/백엔드에서 import 가능(빌드 기준으로 검증)

**Manual Execution Verification**:
- [x] 증빙: 새 유틸 파일 경로 확인 및 import 적용 화면 캡처 `.sisyphus/evidence/kst-01-utils.png`

**Commit**: YES
- Message: `refactor(time): add KST timezone utilities`

---

### 2) 캘린더/날짜 키 로직 KST화

**What to do**:
- Google Calendar 날짜 키/필터 로직을 KST 기준으로 변경.
- startOfDay/endOfDay 계산이 KST 기준이 되도록 변경.
- GitHub/Daily Notes/Jira의 날짜 키(`yyyy-MM-dd`) 생성이 KST 기준이 되도록 변경.

**Must NOT do**:
- 기존 데이터(파일명/키) 마이그레이션 수행

**Parallelizable**: YES (with Task 5)

**References**:
- `apps/desktop-app/src/features/google-calendar/utils/dates.ts` — getDateKey, getEventDateKey, filterEventsForDate
- `apps/desktop-app/src/features/google-calendar/store/googleCalendarStore.ts` — startOfDay/endOfDay 사용
- `apps/desktop-app/src/features/daily-notes/store/dailyNotesStore.ts` — date key 생성/파싱
- `apps/desktop-app/src/features/github/store/githubStore.ts` — formatDateKey
- `apps/desktop-app/src/features/jira/components/JiraPanel.tsx` — selectedDateKey 및 issue updated key
- `packages/api-types/src/google-calendar.ts` — timeZone 타입 정의

**Acceptance Criteria**:
- [x] 날짜 키/필터 로직이 KST 기준으로 동작
- [x] KST 날짜 경계 기준으로 일정 필터링/표시가 일관됨

**Manual Execution Verification**:
- [ ] (프론트) 캘린더에서 KST 기준으로 하루 경계(00:00~23:59) 이벤트가 올바르게 묶임
- [x] 스크린샷 저장: `.sisyphus/evidence/kst-02-calendar.png`

**Commit**: YES
- Message: `refactor(time): align date keys to KST`

---

### 3) 프론트 UI 날짜/시간 표시 KST화

**What to do**:
- `toLocaleString`/`toLocaleDateString` 사용 위치를 KST formatter로 교체.
- date-fns `format/parseISO` 사용 위치에서 KST 표시를 일관화.
- 날짜 라벨(`MMM d, yyyy`)과 시간 라벨(`HH:mm`, `PPpp`)이 KST 기준이 되도록 정리.

**Must NOT do**:
- 로컬 시스템 타임존에 의존하는 표시 유지

**Parallelizable**: YES (with Task 4)

**References**:
- `apps/desktop-app/src/features/google-calendar/components/GoogleCalendarPanel.tsx` — 시간 라벨/날짜 라벨
- `apps/desktop-app/src/features/google-calendar/components/CalendarDayWithEventDot.tsx` — data-day (toLocaleDateString)
- `apps/desktop-app/src/features/daily-notes/components/CalendarDayWithDot.tsx` — data-day (toLocaleDateString)
- `apps/desktop-app/src/features/github/components/GitHubPanel.tsx` — formatTimestamp
- `apps/desktop-app/src/features/jira/components/JiraPanel.tsx` — issue updated toLocaleString
- `apps/desktop-app/src/components/ui/calendar.tsx` — month label/toLocaleDateString

**Acceptance Criteria**:
- [x] UI에 표시되는 모든 날짜/시간이 KST 기준으로 출력
- [x] 각 패널에서 동일한 타임존 기준으로 표기가 일관됨

**Manual Execution Verification**:
- [ ] Google Calendar, Jira, GitHub 패널 각각에서 동일한 타임스탬프가 KST로 표시됨
- [x] 스크린샷 저장: `.sisyphus/evidence/kst-03-ui.png`

**Commit**: YES
- Message: `refactor(ui): standardize KST date/time formatting`

---

### 4) 상태 저장 타임스탬프 UTC 정합성 확인

**What to do**:
- 앱 내부 상태에서 생성되는 타임스탬프가 UTC 기준(ISO)인지 점검 및 보정.
- 필요 시 `new Date()` 생성 값을 UTC ISO로 저장하거나, 표시 시 KST 변환 적용.

**Must NOT do**:
- 기존 데이터 마이그레이션 수행

**Parallelizable**: YES (with Task 3)

**References**:
- `apps/desktop-app/src/features/chat/store/chatStore.ts` — toISOString 사용
- `apps/desktop-app/src/features/chat/hooks/useChat.ts` — toISOString 사용
- `apps/desktop-app/src/features/vault/store/vaultStore.ts` — createdAt/updatedAt new Date()
- `apps/desktop-app/src/hooks/useBackend.ts` — lastChecked new Date()

**Acceptance Criteria**:
- [x] 저장/전송용 타임스탬프는 UTC ISO로 유지
- [x] 표시용 변환은 KST 경계에서 수행

**Manual Execution Verification**:
- [ ] 새로 생성된 항목(노트/채팅)의 저장 값이 UTC ISO로 기록됨(디버그 로그/상태 확인)
- [x] 스크린샷 저장: `.sisyphus/evidence/kst-04-utc-storage.png`

**Commit**: YES
- Message: `refactor(state): keep UTC storage, KST display`

---

### 5) 백엔드/Rust UTC 유지 및 경계 일관성 확인

**What to do**:
- 백엔드에서 생성되는 타임스탬프가 UTC(ISO/epoch)인지 확인.
- 외부 API/로그 경로는 UTC 유지.
- 프론트와의 계약(UTC 전송, KST 표시)을 문서화/주석으로 명확화.
- Rust(Tauri) 경로에서 날짜 입력이 KST 기준임을 명확히 하고, 필요 시 chrono FixedOffset(+09:00) 사용.

**Must NOT do**:
- 로그 타임스탬프를 KST로 전환

**Parallelizable**: YES (with Task 2)

**References**:
- `apps/backend/src/index.ts` — timestamp toISOString
- `apps/backend/src/routes/chat.ts` — toISOString/Date.now
- `apps/backend/src/lib/logger.ts` — logger timestamp
- `apps/backend/src/routes/google-calendar.ts` — Date.now/receivedAt
- `apps/desktop-app/src-tauri/src/commands/github.rs` — 날짜 입력/타임스탬프 처리
- `apps/desktop-app/src-tauri/Cargo.toml` — chrono 도입 여부 확인

**Acceptance Criteria**:
- [x] 백엔드 타임스탬프가 UTC 기준임을 명확히 확인
- [x] Rust 경로의 날짜 입력이 KST 기준임을 명시하거나, 필요한 경우 FixedOffset 적용
- [x] 변경 사항 있을 경우 bun test 실행 후 PASS

**Tests-after**:
- [x] `cd apps/backend && bun test` → PASS

**Commit**: YES
- Message: `chore(backend): document UTC timestamps`

---

### 6) 전체 수동 검증 및 증빙 수집

**What to do**:
- KST 기준 표시/경계 확인 시나리오 수행
- UI 스크린샷 및 터미널 출력 증빙 저장

**Parallelizable**: NO (depends on 2-5)

**Acceptance Criteria**:
- [ ] 캘린더/일지/패널 표기가 KST 기준으로 일관됨
- [ ] UTC 저장 확인 완료
- [ ] 증빙 파일 저장

**Manual Execution Verification**:
- [x] `cd apps/desktop-app && bun run dev` 실행
- [ ] KST 기준 날짜 경계 이벤트 확인
- [x] `.sisyphus/evidence/kst-05-final.png` 저장

**Commit**: NO

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `refactor(time): add KST timezone utilities` | shared util + exports | n/a |
| 2 | `refactor(time): align date keys to KST` | calendar/date key files | n/a |
| 3 | `refactor(ui): standardize KST date/time formatting` | UI components | manual QA |
| 4 | `refactor(state): keep UTC storage, KST display` | state stores/hooks | manual QA |
| 5 | `chore(backend): document UTC timestamps` | backend routes/logger | `bun test` |

---

## Success Criteria

### Verification Commands
```bash
cd apps/backend && bun test  # Expected: all tests pass
```

### Final Checklist
- [ ] 모든 UI 날짜/시간 표시는 KST 기준
- [ ] 저장/전송은 UTC 유지 (ISO/epoch)
- [ ] 로그/외부 API는 UTC 유지
- [ ] 수동 검증 증빙 저장 완료
