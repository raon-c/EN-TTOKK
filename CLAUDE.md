# EN:TTOKK 프로젝트 작업 가이드

`AGENTS.md`는 `CLAUDE.md`를 가리키는 심볼릭 링크입니다.
이 문서는 사람/에이전트가 동일한 기준으로 작업하기 위한 단일 운영 기준서입니다.

## 1) 프로젝트 개요

- 앱 성격: `Tauri + React + TypeScript` 기반 데스크톱 앱
- 핵심 도메인:
  - Vault 기반 마크다운 노트 편집
  - Claude CLI 채팅/스트리밍
  - GitHub 활동 조회
  - Jira 연동
  - Google Calendar 연동
- 런타임 구조:
  - 프런트엔드(`src/`)는 Zustand 스토어 중심
  - 백엔드(`src-tauri/`)는 Tauri command(IPC) 중심
  - 타입 바인딩은 `src/bindings.ts`(자동 생성)

## 2) 필수 환경/도구

### 필수 바이너리

- `bun`
- `tauri` CLI (`@tauri-apps/cli`)
- `claude` CLI (채팅 기능)
- `gh` CLI (GitHub 활동 기능)

### 환경 변수 (`.env`)

값은 절대 문서/커밋/로그에 노출하지 않습니다.

- `GOOGLE_API_KEY`
- `VITE_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 로컬 전제

- Google OAuth 콜백은 `127.0.0.1:31337` 포트를 사용합니다.
- Jira는 `https://<org>.atlassian.net` 형태의 Cloud URL만 허용합니다.

## 3) 자주 쓰는 명령

- 개발 서버: `bun run dev`
- Tauri 통합 개발: `bun run tauri:dev`
- 빌드: `bun run build`
- 포맷/린트/체크:
  - `bun run format`
  - `bun run lint`
  - `bun run check`

기본 품질 게이트(최소):

1. `bun run check`
2. `bun run build`

## 4) 코드 구조

- `src/features/*`: 기능 단위 모듈(컴포넌트/스토어/타입)
- `src/lib/*`: 공통 유틸, API 클라이언트, 스토리지 헬퍼
- `src/components/*`: UI/공통 컴포넌트
- `src-tauri/src/commands/*`: Tauri command 구현
- `src-tauri/src/lib.rs`: command 등록, 플러그인, 메뉴 설정

새 기능 추가 원칙:

1. 프런트 상태/로직은 `src/features/<domain>/store` 우선
2. 외부 연동은 프런트 API 레이어(`src/lib/api-client.ts`) + Tauri command를 쌍으로 추가
3. 공통 타입은 기존 `src/types`/`src/features/*/types.ts` 패턴 재사용

## 5) 구현 가드레일

### 스타일/포맷

- TypeScript `strict` 모드 기준을 지킵니다.
- 포맷/정렬은 Biome 기준(`double quote`, `semicolon`)을 따릅니다.
- 코드 변경 후 `bun run check`를 기본 실행합니다.

### 생성 파일

- `src/bindings.ts`는 `tauri-specta` 자동 생성 파일입니다.
- 직접 수동 수정하지 않습니다.
- Tauri command 타입 변경 시 생성 결과를 검토하고 커밋에 포함합니다.

### 보안

- 시크릿/토큰/개인정보를 커밋하지 않습니다.
- Jira API 토큰은 키체인(`keyring`) 경유 저장을 사용합니다.
- Vault 파일 작업은 반드시 vault 경로 검증 로직을 유지합니다.
- 경로 순회(`..`)나 null byte 같은 입력은 차단 패턴을 유지합니다.

## 6) 통합 플레이북

### Claude 채팅

증상:
- 앱에서 Claude 상태가 unavailable
- 채팅 스트림이 시작되지 않음

1차 확인:

1. `claude --version`
2. CLI 인증/실행 가능 여부 점검
3. 앱 재실행 후 상태 재확인

주의:
- 현재 백엔드는 `stream-json` 출력 파싱을 전제로 동작합니다.
- CLI 인자가 바뀌면 `src-tauri/src/commands/chat_ipc.rs`를 우선 확인합니다.

### GitHub 활동

증상:
- GitHub 패널에서 disconnected/error

1차 확인:

1. `gh auth status`
2. `gh api user --jq .login`

주의:
- `gh` 미설치/미인증이면 기능이 실패합니다.

### Jira 연동

증상:
- 연결 테스트 실패
- 이슈 목록 조회 실패

1차 확인:

1. Base URL이 `https://<org>.atlassian.net`인지 확인
2. 이메일/API 토큰 확인
3. 키체인 접근 권한 문제 여부 확인

주의:
- 토큰은 평문 저장하지 않고 secure-store 경로를 사용합니다.

### Google Calendar

증상:
- OAuth 연결 시간 초과
- 토큰 교환 실패

1차 확인:

1. `VITE_GOOGLE_CLIENT_ID` 설정 확인
2. `GOOGLE_CLIENT_SECRET` 설정 확인
3. `127.0.0.1:31337` 포트 충돌 확인

주의:
- 리다이렉트 URI는 코드 상수와 OAuth 설정이 일치해야 합니다.

## 7) 브랜치/커밋/PR 규칙

- 기본 브랜치 직접 커밋은 지양합니다.
- 브랜치 네이밍은 `codex/*` 접두사 사용을 권장합니다.
- 커밋 메시지는 Conventional Commit 형식 권장:
  - `feat(scope): ...`
  - `fix(scope): ...`
  - `docs(scope): ...`

## 8) 작업 완료 기준 (Definition of Done)

모든 변경은 아래를 만족해야 완료로 간주합니다.

1. 요구사항 구현 완료
2. 문서/코드 일관성 확인
3. `bun run check` 통과
4. `bun run build` 통과
5. 사용자 영향이 있는 변경이면 운영 검증 항목(모니터링/롤백 기준) 준비

## 9) 문서 동기화 규칙

다음 변경이 발생하면 `CLAUDE.md`를 반드시 함께 갱신합니다.

- 실행 명령 변경(`package.json`)
- 환경 변수 추가/변경
- 통합 흐름(Claude/GitHub/Jira/Google) 변경
- 생성 파일 정책 변경
- 최소 품질 게이트 변경
