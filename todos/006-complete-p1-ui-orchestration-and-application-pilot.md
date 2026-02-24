---
status: complete
priority: p1
issue_id: "006"
tags: [architecture, ui-orchestration, application-layer, transport]
dependencies: ["005"]
---

# UI Orchestration 축소 + Application 계층 Pilot

## Problem Statement

`App.tsx`/`EditorLayout.tsx`에 초기화·핫키·자동복원·사이드바 상태 전이가 직접 섞여 있었고, `claude`/`secure` command에 도메인 실행 로직이 남아 있었다.

## Findings

- `src/App.tsx`는 앱 부팅/설정 다이얼로그 이벤트/이전 vault 자동복원을 직접 수행
- `src/layouts/EditorLayout.tsx`는 dirty 상태/사이드바 탭/chat 확장/단축키를 직접 관리
- `src-tauri/src/commands/claude.rs`, `src-tauri/src/commands/secure.rs`가 transport와 도메인 실행을 함께 가짐

## Proposed Solutions

1. 상위 UI orchestration을 custom hook으로 분리
2. Rust에 `application` 모듈을 추가하고 command는 transport 경계로 축소

## Acceptance Criteria

- [x] `App.tsx`에서 부팅/자동복원/설정 열기 orchestration이 hook으로 이동한다.
- [x] `EditorLayout.tsx`에서 sidebar/dirty/hotkey orchestration이 hook으로 이동한다.
- [x] `claude`/`secure` command가 application 계층으로 도메인 실행을 위임한다.
- [x] `cargo test`, `bun run check`, `bun run build` 통과.

## Work Log

### 2026-02-20 - 구현 완료

**By:** Codex

**Actions:**
- `src/features/app/hooks/useAppOrchestration.ts` 추가 후 `src/App.tsx`를 화면 조합 중심으로 정리
- `src/layouts/hooks/useEditorLayoutOrchestration.ts` 추가 후 `src/layouts/EditorLayout.tsx` 상태 전이 로직 분리
- `src-tauri/src/application/mod.rs`, `src-tauri/src/application/secure.rs`, `src-tauri/src/application/claude_activity.rs` 추가
- `src-tauri/src/commands/secure.rs`, `src-tauri/src/commands/claude.rs`를 thin transport 래퍼로 재작성
- 문서/체크리스트 업데이트:
  - `docs/architecture/2026-02-20-cross-cutting-foundation.md`
  - `docs/plans/2026-02-20-refactor-end-to-end-cross-cutting-architecture-redesign-plan.md`

**Learnings:**
- command에서 trace/error 경계만 유지하면 비즈니스 로직 변경 시 command surface의 변동이 작아져 계약 관리가 쉬워진다.
