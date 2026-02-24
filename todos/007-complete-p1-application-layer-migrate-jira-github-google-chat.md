---
status: complete
priority: p1
issue_id: "007"
tags: [architecture, application-layer, command-transport, jira, github, google, chat]
dependencies: ["006"]
---

# Application Layer Migration for Jira/GitHub/Google/Chat

## Problem Statement

`006` 이후에도 `jira/github/google/chat` command가 transport와 도메인 실행을 함께 담당하고 있어 `command -> application` 분리가 완결되지 않았다.

## Findings

- `src-tauri/src/commands/github.rs`에 GitHub 조회 파싱/CLI 실행 로직이 포함됨
- `src-tauri/src/commands/jira.rs`에 Jira validation/http/domain 매핑 로직이 포함됨
- `src-tauri/src/commands/google_calendar.rs`에 OAuth callback/token/events 로직이 포함됨
- `src-tauri/src/commands/chat_ipc.rs`에 stream parsing/process lifecycle/state 추적 로직이 포함됨

## Proposed Solutions

1. `src-tauri/src/application/*`에 도메인 실행 모듈을 추가
2. command는 trace/error 매핑 + application 호출만 담당하는 thin transport로 축소

## Acceptance Criteria

- [x] `jira/github/google/chat` 도메인 실행이 `src-tauri/src/application/*`로 이동한다.
- [x] 대응 command 파일은 transport 경계 중심(wrapper)으로 동작한다.
- [x] `cargo check`, `cargo test`, `bun run check`, `bun run build` 통과.

## Work Log

### 2026-02-20 - 구현 완료

**By:** Codex

**Actions:**
- 추가: `src-tauri/src/application/github_activity.rs`
- 추가: `src-tauri/src/application/jira.rs`
- 추가: `src-tauri/src/application/google_calendar.rs`
- 추가: `src-tauri/src/application/chat_stream.rs`
- 수정: `src-tauri/src/application/mod.rs` 모듈 등록
- 재작성: `src-tauri/src/commands/github.rs` thin wrapper
- 재작성: `src-tauri/src/commands/jira.rs` thin wrapper
- 재작성: `src-tauri/src/commands/google_calendar.rs` thin wrapper
- 재작성: `src-tauri/src/commands/chat_ipc.rs` thin wrapper
- 문서 동기화:
  - `docs/architecture/2026-02-20-cross-cutting-foundation.md`
  - `docs/plans/2026-02-20-refactor-end-to-end-cross-cutting-architecture-redesign-plan.md`
  - `CLAUDE.md`

**Learnings:**
- command wrapper에서 source/trace/error taxonomy를 고정하면 도메인 구현 변경이 IPC 계약에 미치는 영향이 작아져 이관 속도와 안정성이 함께 개선된다.
