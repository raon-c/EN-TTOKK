# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**EN:TTOKK** — 볼트 기반 마크다운 노트 편집기, AI 채팅, 회의 녹음/전사, 개발자 도구 통합(GitHub, Jira, Google Calendar)을 제공하는 한국어 데스크톱 생산성 앱입니다.

Bun 모노레포로 구성되며, React 19 프론트엔드 + Rust 백엔드의 Tauri 2.x 데스크톱 앱과 Hono 기반 Bun 백엔드 서버를 포함합니다.

## 명령어

별도 표기가 없으면 저장소 루트에서 실행합니다.

```bash
bun install                    # 의존성 설치

# 개발 (백엔드 + Tauri 동시 실행, 전체 기능 사용 시 필수)
cd apps/desktop-app && bun run dev:full

# 프론트엔드만 실행 (Vite 개발 서버, 포트 1420)
cd apps/desktop-app && bun run dev

# 백엔드만 실행 (포트 31337, hot reload)
bun run backend:dev

# 프로덕션 빌드 (sidecar 빌드 포함)
cd apps/desktop-app && bun run tauri:build

# TypeScript 타입 검사
cd apps/desktop-app && bunx tsc --noEmit

# 코드 품질 (Biome)
bun run check                  # 린트 + 포매팅 검사
bun run check:fix              # 자동 수정

# 백엔드 테스트
cd apps/backend && bun test
```

## 아키텍처

### 워크스페이스 구조

- **`apps/desktop-app`** — Tauri 데스크톱 앱 (React 프론트엔드 + Rust 백엔드)
- **`apps/backend`** — Hono 기반 Bun HTTP 서버 (Claude 채팅, Google Calendar, Jira 프록시)
- **`packages/shared`** — KST 시간/날짜 유틸리티
- **`packages/api-types`** — 프론트엔드-백엔드 공유 TypeScript 타입

### 프론트엔드 (apps/desktop-app/src/)

**피처 기반 아키텍처** — 각 기능은 `features/{name}/` 아래 components, store, hooks, types로 구성됩니다.

주요 피처: `vault` (파일 탐색/관리), `editor` (TipTap 마크다운 편집기), `chat` (Claude AI), `daily-notes` (캘린더 일일 노트), `meeting-notes` (Whisper 전사), `google-calendar`, `jira`, `github`, `claude-activity`, `settings`, `shortcuts`

**상태 관리:** Zustand 스토어 (피처당 1개). 설정/볼트 경로는 Tauri plugin-store, 자격 증명은 plugin-stronghold에 저장.

**UI:** Radix UI + Tailwind CSS 4 (shadcn/ui 패턴). 컴포넌트는 `src/components/ui/`.

**레이아웃:** 단일 페이지 앱 (라우터 없음). 좌측 사이드바(파일 탐색기), 중앙(편집기), 우측 사이드바(탭: 캘린더, 채팅, Google Calendar, Jira, GitHub, Claude Activity, Meeting Notes).

### Rust 백엔드 (apps/desktop-app/src-tauri/)

Tauri 커맨드는 `src/commands/` 아래 모듈별로 분리: `vault.rs`, `file.rs`, `github.rs`, `secure.rs` (keyring), `claude.rs`, `whisper.rs`.

**tauri-specta로 TypeScript 바인딩 자동 생성** — Rust 커맨드에 `#[specta::specta]` 데코레이터 추가 시 `src/bindings.ts`가 자동 업데이트됩니다. 프론트엔드에서는 이 바인딩을 통해 타입 안전하게 호출합니다.

### Bun 백엔드 (apps/backend/)

Hono 프레임워크, 포트 31337. 프로덕션에서는 Tauri sidecar로 자동 실행. 개발 시 `dev:full`로 동시 실행하거나 `backend:dev`로 별도 실행.

- `/chat/*` — Claude AI SSE 스트리밍
- `/integrations/google-calendar/*` — OAuth 2.0 + Calendar API
- `/integrations/jira/*` — Jira REST API 프록시

### Tauri IPC 패턴

```typescript
// 프론트엔드: bindings.ts에서 타입 안전한 함수 import
import { commands } from "../bindings";
const result = await commands.readFile(path);
```

```rust
// Rust: specta 데코레이터로 자동 바인딩 생성
#[tauri::command]
#[specta::specta]
fn read_file(path: String) -> Result<String, String> { ... }

// lib.rs의 collect_commands![]에 등록 필수
```

## 개발 참고사항

- Vite 개발 서버: `localhost:1420`, HMR: 포트 1421
- 백엔드 서버: `localhost:31337` (CORS: localhost:1420 + tauri://localhost)
- Rust 변경 시 Tauri가 자동 재빌드, `src-tauri/`는 Vite 감시 제외
- 한국어 로케일/KST 타임존 기본 사용 (date-fns `ko` 로케일)
- 마크다운 ↔ HTML 변환: 디스크에 마크다운 저장, TipTap 편집기에서 HTML로 변환

## 추가 규칙

`.claude/rules/` 디렉토리에서 상세 가이드라인을 참고하세요:

- `coding-style.md` — 불변성(필수), 파일 크기(800줄 이하), 함수 크기(50줄 이하)
- `testing.md` — 80% 커버리지, TDD 워크플로우
- `security.md` — 시크릿 관리, 입력 검증
- `agents.md` — 전문 에이전트 활용 가이드
- `git-workflow.md` — 커밋 형식(conventional commits), PR 워크플로우
- `patterns.md` — API 응답 형식, 커스텀 훅, 리포지토리 패턴
- `performance.md` — 모델 선택 전략, 컨텍스트 윈도우 관리
- `hooks.md` — PreToolUse/PostToolUse 훅 설정
