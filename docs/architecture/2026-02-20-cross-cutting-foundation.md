# EN:TTOKK Cross-Cutting Foundation (Phase 1)

Date: 2026-02-20
Status: active

## 1. Goal

`docs/plans/2026-02-20-refactor-end-to-end-cross-cutting-architecture-redesign-plan.md`의 Foundation 단계에서, 전체 대이관 전에 공통 경계를 먼저 고정한다.

- 공통 오류 규격: `code`, `message`, `retryable`, `traceId`, `source`
- 공통 추적 규격: 명령 경계(traceId) 전달
- 공통 호출 규격: 프런트 invoke 경로의 재시도/오류 정규화

## 2. End-to-End Slice Map

현재 코드 구조를 아래 5개 슬라이스 관점으로 운영한다.

- `vault-workspace`
  - `src/features/vault/*`
  - `src/features/editor/*`
  - `src/features/daily-notes/*`
- `ai-conversation`
  - `src/features/chat/*`
  - `src/features/daily-summary/*`
- `activity-observatory`
  - `src/features/github/*`
  - `src/features/claude-activity/*`
- `planning-calendar`
  - `src/features/google-calendar/*`
- `issue-tracking`
  - `src/features/jira/*`

## 3. Cross-Cutting Modules

### Frontend

- `src/lib/platform/errors.ts`
- `src/lib/platform/trace.ts`
- `src/lib/platform/reliability.ts`
- `src/lib/platform/invoke.ts`

적용 규칙:

1. Tauri invoke는 `invokeCommand`로 통일
2. 사용자 에러는 `PlatformError`로 정규화
3. 재시도 정책은 `withRetry`로 적용

### Backend (Tauri)

- `src-tauri/src/platform/error.rs`
- `src-tauri/src/platform/trace.rs`
- `src-tauri/src/application/chat_stream.rs`
- `src-tauri/src/application/secure.rs`
- `src-tauri/src/application/claude_activity.rs`
- `src-tauri/src/application/github_activity.rs`
- `src-tauri/src/application/jira.rs`
- `src-tauri/src/application/google_calendar.rs`
- 적용 command:
  - `src-tauri/src/commands/health.rs`
  - `src-tauri/src/commands/github.rs`
  - `src-tauri/src/commands/jira.rs`
  - `src-tauri/src/commands/google_calendar.rs`
  - `src-tauri/src/commands/chat_ipc.rs`
  - `src-tauri/src/commands/claude.rs`
  - `src-tauri/src/commands/secure.rs`

적용 규칙:

1. command 오류는 `AppError` 형태를 우선 사용
2. traceId는 입력값이 없으면 백엔드에서 생성
3. command source는 `<domain>.<command>`로 기록
4. command는 transport boundary만 담당하고 도메인 실행은 `application` 모듈로 위임

### UI Orchestration Hooks

- `src/features/app/hooks/useAppOrchestration.ts`
- `src/layouts/hooks/useEditorLayoutOrchestration.ts`

적용 규칙:

1. `App.tsx`와 `EditorLayout.tsx`는 화면 조합/렌더링 위주로 유지
2. 초기화/핫키/자동복원/사이드바 상태 전이는 hook에서 관리

## 4. Command Contract Pilot

초기 적용 command는 health + 주요 integration command(gh/jira/google/chat/claude/secure) 경로다.

- `ipc_health_check`
  - input: `traceId?: string`
  - response: `{ status, timestamp, traceId }`
  - error: `AppError`
- `get_github_activity`
  - input: `{ date, traceId? }`
  - response: `GitHubActivityResponse`
  - error: `AppError` (code/retryable/source/traceId)
- `jira_test_connection`, `jira_list_issues`
  - input: `{ params, traceId? }`
  - response: Jira 응답 타입
  - error: `AppError` (code/retryable/source/traceId)
- `google_prepare_oauth`, `google_poll_oauth_result`, `google_exchange_token`, `google_list_events`
  - input: `traceId?` (및 각 command payload)
  - response: Google OAuth/Event 응답 타입
  - error: `AppError` (code/retryable/source/traceId)
- `chat_start_stream`, `chat_cancel_stream`
  - input: `traceId?` (및 각 command payload)
  - response: stream 시작/취소 결과
  - error: `AppError` (code/retryable/source/traceId)
- `list_claude_projects`, `get_claude_activities`, `get_claude_activity_dates`
  - input: `traceId?` (및 각 command payload)
  - response: Claude activity 응답 타입
  - error: `AppError` (code/retryable/source/traceId)
- `get_jira_token`, `set_jira_token`, `remove_jira_token`
  - input: `traceId?` (및 각 command payload)
  - response: secure-store 응답 타입
  - error: `AppError` (code/retryable/source/traceId)

## 5. Security Baseline (Tauri v2)

### Capability/Permission Matrix

`src-tauri/capabilities/default.json` 기준

- `core:default`
- `opener:default`
- `dialog:default`
- `store:default`
- `stronghold:default`

운영 원칙:

1. 신규 플러그인 추가 시 capability에 명시 후 코드 반영
2. 권한 검토 없이 `default` 확장 금지
3. command 노출 추가 시 최소 권한 범위 재검토

### CSP Baseline

`src-tauri/tauri.conf.json`에 CSP를 명시한다.

- 기본: `default-src 'self'`
- 외부 연결 허용: GitHub/Jira/Google API + Tauri IPC + dev websocket

## 6. Migration Rule

1. 신규 command는 `AppError` + traceId 전달을 우선 적용
2. 기존 command는 영향 범위가 작은 경로부터 순차 전환
3. 프런트 store에서 직접 invoke 금지, `api-client` 경유만 허용
