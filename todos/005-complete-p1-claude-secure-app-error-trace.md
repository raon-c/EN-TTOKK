---
status: complete
priority: p1
issue_id: "005"
tags: [architecture, cross-cutting, claude-activity, secure-store, trace]
dependencies: ["004"]
---

# Claude Activity / Secure Store Cross-Cutting Alignment

## Problem Statement

`004` 완료 후에도 `claude`/`secure` command와 프런트 호출 경로 일부가 `Result<_, String>` + 직접 `invoke` 기반으로 남아 있어 `AppError + traceId` 표준이 완결되지 않았다.

## Findings

- `src-tauri/src/commands/claude.rs` command 3개가 문자열 오류를 반환
- `src-tauri/src/commands/secure.rs` command 3개가 문자열 오류를 반환
- `src/lib/claude.ts`, `src/lib/secure-store.ts`가 공통 `invokeCommand`를 우회함
- `src/features/claude-activity/store/claudeActivityStore.ts`는 공통 에러 정규화를 사용하지 않음

## Proposed Solutions

1. claude/secure command를 `AppResult` + `traceId` 입력으로 전환
2. 프런트 claude/secure 래퍼를 `invokeCommand` 기반으로 통일
3. Claude Activity store 오류를 `normalizeAppError` 기반으로 표준화

## Recommended Action

1~3 동시 적용 후 바인딩/빌드 검증으로 계약 드리프트를 차단.

## Acceptance Criteria

- [x] claude/secure command가 `AppResult` + `traceId` 입력 경계를 사용한다.
- [x] `src/lib/claude.ts`, `src/lib/secure-store.ts`가 `invokeCommand`를 사용한다.
- [x] Claude Activity store 오류 메시지에 trace ID가 포함된다.
- [x] `bun run check`, `bun run build`, `cargo check`, `cargo test export_bindings` 통과.

## Work Log

### 2026-02-20 - Claude/Secure 공통 경계 적용 완료

**By:** Codex

**Actions:**
- `src-tauri/src/commands/claude.rs`를 `AppResult` + `traceId` 입력 기반으로 전환하고 오류 분류/매핑을 추가
- `src-tauri/src/commands/secure.rs`를 `AppResult` + `traceId` 입력 기반으로 전환하고 오류 분류/매핑을 추가
- `src/lib/claude.ts`, `src/lib/secure-store.ts`를 `invokeCommand` 기반으로 전환
- `src/features/claude-activity/store/claudeActivityStore.ts`에 `normalizeAppError` 기반 trace 포함 오류 메시지 적용
- 문서 업데이트: `docs/architecture/2026-02-20-cross-cutting-foundation.md`
- 검증 실행: `bun run check`, `bun run build`, `cd src-tauri && cargo check`, `cd src-tauri && cargo test export_bindings`

**Learnings:**
- activity-observatory와 secure-store까지 포함하면 사용자-운영자 공통 추적 체계가 외부 연동 전반에 걸쳐 일관되게 유지된다.
