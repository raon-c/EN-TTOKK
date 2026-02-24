---
status: complete
priority: p1
issue_id: "003"
tags: [architecture, cross-cutting, github, jira, reliability]
dependencies: ["002"]
---

# GitHub/Jira Command Cross-Cutting Alignment

## Problem Statement

Foundation 1차 적용 이후에도 GitHub/Jira command는 `Result<_, String>` 기반이라, 공통 `AppError + traceId` 규격이 health 외 경로에 충분히 확장되지 않았다.

## Findings

- `src-tauri/src/commands/github.rs`는 모든 오류를 문자열로 반환
- `src-tauri/src/commands/jira.rs`도 문자열 오류 중심이며 frontend에서 traceId를 직접 식별하기 어려움
- frontend store(`githubStore`, `jiraStore`)는 trace 정보를 사용자 피드백으로 표출하지 않음

## Proposed Solutions

1. GitHub/Jira command에 `traceId` 입력 + `AppError` 반환 전환
2. frontend invoke에 trace 전달(`traceArgName`) 및 store 메시지에 trace 포함

## Recommended Action

1+2를 함께 적용해 command 경계와 UX 피드백을 동시에 정렬.

## Acceptance Criteria

- [x] GitHub/Jira command가 `AppResult`를 사용하고 `traceId`를 입력받는다.
- [x] `src/lib/api-client.ts`/`src/lib/github.ts`가 trace 전달 경로를 사용한다.
- [x] GitHub/Jira store 오류 메시지에 trace ID가 포함된다.
- [x] `bun run check`, `bun run build`, `cd src-tauri && cargo check`가 통과한다.

## Work Log

### 2026-02-20 - 작업 시작

**By:** Codex

**Actions:**
- 002 완료 후 003 작업 범위 정의
- GitHub/Jira 경로 확장을 다음 단위로 선정

**Learnings:**
- health pilot 다음 단계로 외부 API command 전환이 가장 영향 대비 효율이 높음

### 2026-02-20 - GitHub/Jira 공통 경계 적용 완료

**By:** Codex

**Actions:**
- `src-tauri/src/commands/github.rs`를 `AppResult` + `traceId` 입력 기반으로 전환하고 오류 코드 분류 로직 추가
- `src-tauri/src/commands/jira.rs`를 `AppResult` + `traceId` 입력 기반으로 전환하고 retryable/error code 분류 로직 추가
- `src/lib/github.ts`, `src/lib/api-client.ts`에서 `traceArgName: \"traceId\"` 전달 적용
- `src/features/github/store/githubStore.ts`, `src/features/jira/store/jiraStore.ts`에서 `normalizeAppError` 기반 trace 표시 적용
- 문서 반영: `docs/architecture/2026-02-20-cross-cutting-foundation.md`, `CLAUDE.md`
- 검증 실행: `bun run check`, `cd src-tauri && cargo check`, `cd src-tauri && cargo test export_bindings`, `bun run build`

**Learnings:**
- command 단의 에러 분류(code/retryable)가 생기면 프런트 스토어는 에러 파싱보다 사용자 피드백/복구 UX에 집중할 수 있음
