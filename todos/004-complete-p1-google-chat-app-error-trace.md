---
status: complete
priority: p1
issue_id: "004"
tags: [architecture, cross-cutting, google-calendar, chat, trace]
dependencies: ["003"]
---

# Google/Chat Command Cross-Cutting Alignment

## Problem Statement

`003` 완료 후에도 `google_calendar`와 `chat_ipc` command는 `Result<_, String>` 기반이라 `AppError + traceId` 표준이 완전하게 확장되지 않았다.

## Findings

- `src-tauri/src/commands/google_calendar.rs` command 4개가 문자열 오류를 반환
- `src-tauri/src/commands/chat_ipc.rs`의 stream start/cancel 경로가 문자열 오류만 반환
- 프런트 `api-client`와 `chatStore`/`googleCalendarStore`는 해당 경로 trace 전달이 일관되지 않음

## Proposed Solutions

1. google/chat command를 `AppResult`로 전환하고 traceId 입력 인자 추가
2. 프런트 invoke 호출에 `traceArgName` 적용 및 store 에러 표출 규칙 통일

## Recommended Action

1+2 동시 적용 후 빌드/바인딩 검증으로 계약 동기화 보장.

## Acceptance Criteria

- [x] Google/Chat command가 `AppResult` + `traceId` 입력 경계를 사용한다.
- [x] 프런트 invoke에서 해당 command 호출 시 traceId를 전달한다.
- [x] Chat/Google Calendar store 오류 메시지에 trace ID가 포함된다.
- [x] `bun run check`, `bun run build`, `cargo check`, `cargo test export_bindings` 통과.

## Work Log

### 2026-02-20 - 작업 시작

**By:** Codex

**Actions:**
- 다음 단계로 google/chat 경계를 선택
- 대상 파일 스캔 및 수정 범위 확정

**Learnings:**
- 외부 API 경계 + 스트리밍 경계를 정렬하면 Phase 1에서 주요 실패 경로 대부분이 traceable 해짐

### 2026-02-20 - Google/Chat 공통 경계 적용 완료

**By:** Codex

**Actions:**
- `src-tauri/src/commands/google_calendar.rs`를 `AppResult` + `traceId` 입력 기반으로 전환하고 에러 코드/재시도 가능성 분류 로직 추가
- `src-tauri/src/commands/chat_ipc.rs`의 `chat_start_stream`/`chat_cancel_stream`을 `AppResult` + `traceId` 입력 기반으로 전환
- `src/lib/api-client.ts`에서 chat/google command에 `traceArgName: \"traceId\"` 전달 적용
- `src/features/chat/store/chatStore.ts`, `src/features/google-calendar/store/googleCalendarStore.ts`에 `normalizeAppError` 기반 trace 포함 에러 메시지 적용
- 문서 업데이트: `docs/architecture/2026-02-20-cross-cutting-foundation.md`
- 검증 실행: `bun run check`, `bun run build`, `cd src-tauri && cargo check`, `cd src-tauri && cargo test export_bindings`

**Learnings:**
- stream start/cancel 경계에도 traceId를 넣으면 실패 원인 추적이 API 경로와 동일한 패턴으로 통일됨
