---
status: complete
priority: p1
issue_id: "001"
tags: [documentation, claude-md, workflow]
dependencies: []
---

# CLAUDE.md 한국어 운영 가이드 작성

프로젝트 루트 `CLAUDE.md`가 비어 있어 작업 표준과 실행 규칙이 누락된 상태를 해소한다.

## 실행 작업

- [x] `CLAUDE.md`를 한국어로 작성한다.
- [x] 환경 변수, 실행 명령, 코드 구조, 통합(Claude/GitHub/Jira/Google) 플레이북을 반영한다.
- [x] 보안 원칙(시크릿 비노출, 키체인 사용, 경로 검증)을 명시한다.
- [x] `docs/plans/2026-02-20-feat-project-claude-md-operating-guide-plan.md` 체크박스를 갱신한다.
- [x] `status: active`를 `status: completed`로 변경한다.
- [x] 품질 점검(`bun run check`, `bun run build`)을 수행한다.

## Acceptance Criteria

- [x] `CLAUDE.md`에 프로젝트 운영에 필요한 핵심 섹션이 한국어로 정리됨
- [x] 문서 내 명령/환경 변수/행동 규칙이 코드베이스와 일치함
- [x] 플랜 문서 체크박스/상태가 완료로 갱신됨
- [x] 품질 점검 명령 결과 확인 완료

## Work Log

### 2026-02-20 - 작업 시작

**By:** Codex

**Actions:**
- `workflows-work` 스킬 기반 실행 시작
- 기본 브랜치(`master`)에서 작업 브랜치 생성
- 파일 기반 TODO 생성

**Learnings:**
- `AGENTS.md`가 `CLAUDE.md` 심볼릭 링크이므로 문서 품질이 곧 에이전트 규칙 품질에 직결됨

### 2026-02-20 - 문서 작성 및 검증 완료

**By:** Codex

**Actions:**
- `CLAUDE.md` 한국어 운영 가이드 작성 완료
- 플랜 문서 완료 체크 및 상태(`completed`) 반영
- `bun run check` 실행(경고 4건, 실패 없음)
- `bun run build` 실행 전 의존성 누락 확인 후 `bun install`
- `bun run build` 재실행 성공 확인

**Learnings:**
- 문서 변경만으로도 로컬 의존성 동기화 상태에 따라 빌드 실패가 날 수 있어, 품질 게이트 전 `bun install`이 필요할 수 있음
