---
status: complete
priority: p1
issue_id: "002"
tags: [architecture, cross-cutting, tauri, typescript]
dependencies: []
---

# Cross-Cutting Foundation (Phase 1)

## Problem Statement

`docs/plans/2026-02-20-refactor-end-to-end-cross-cutting-architecture-redesign-plan.md`의 Foundation 단계(공통 에러/추적/정책 경계)가 코드에 아직 반영되지 않아, 기능별 오류 형식과 호출 경계가 분산되어 있다.

## Findings

- `src/lib/api-client.ts`는 command 호출/오류 처리 규칙이 기능별로 혼재되어 있음
- `src-tauri/src/commands/*`는 `Result<_, String>` 위주로 공통 에러 스키마가 없음
- `tauri.conf.json`의 CSP가 `null`로 설정되어 문서화된 보안 기준이 없음

## Proposed Solutions

1. 공통 플랫폼 타입/헬퍼를 먼저 도입하고 일부 경로(health)부터 점진 전환
2. 모든 command를 한 번에 envelope로 전환

## Recommended Action

1번 선택: 리스크가 낮고 회귀 범위가 작아 incremental migration에 적합.

## Acceptance Criteria

- [x] 프런트에 공통 `AppError`/`traceId` 정규화 모듈이 추가된다.
- [x] 백엔드에 공통 `AppError`/`traceId` 모듈이 추가된다.
- [x] health command가 공통 경계를 사용하는 시범 경로로 전환된다.
- [x] 아키텍처/보안 문서(슬라이스, capability, CSP)가 동기화된다.
- [x] `bun run check`와 `bun run build`가 통과한다.

## Work Log

### 2026-02-20 - 작업 시작

**By:** Codex

**Actions:**
- `workflows-work` 스킬 기준으로 플랜/코드베이스 분석
- 기본 브랜치에서 `codex/refactor-cross-cutting-foundation` 브랜치 생성
- 실행 TODO 파일 생성

**Learnings:**
- 전체 리팩터링은 범위가 크므로 Foundation 단위 incremental 적용이 현실적

### 2026-02-20 - Foundation 적용 완료

**By:** Codex

**Actions:**
- 프런트 공통 플랫폼 모듈(`src/lib/platform/*`) 추가 및 `api-client`/GitHub 호출 경계 통합
- 백엔드 공통 플랫폼 모듈(`src-tauri/src/platform/*`) 추가 및 `ipc_health_check`에 traceId + `AppError` 규격 적용
- 보안 기준 문서화(`docs/architecture/2026-02-20-cross-cutting-foundation.md`) 및 CSP 설정 명시
- `CLAUDE.md` 아키텍처 경계 섹션 업데이트
- 플랜 체크박스 동기화 및 `cargo test export_bindings` 실행
- 검증 실행: `bun run check`, `bun run build`, `cd src-tauri && cargo check`

**Learnings:**
- 전면 마이그레이션 전에도 health 같은 작은 command부터 공통 경계를 도입하면 리스크 없이 패턴을 고정할 수 있음
