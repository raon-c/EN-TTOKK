---
review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle]
plan_review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer]
---

# Review Context

이 저장소는 `Tauri + React + TypeScript` 기반 데스크톱 앱입니다.
리뷰 시 아래 기준을 우선 적용합니다.

## 아키텍처와 경계

- 프런트엔드 상태/도메인 로직은 `src/features/<domain>/store` 중심 패턴을 유지합니다.
- 공통 유틸과 API 클라이언트는 `src/lib/*`, 공통 UI는 `src/components/*`에 유지합니다.
- 외부 연동 변경은 프런트(`src/lib/api-client.ts`)와 Tauri command(`src-tauri/src/commands/*`)를 쌍으로 검토합니다.
- Tauri command 추가/변경 시 `src-tauri/src/lib.rs` 등록 누락 여부를 반드시 확인합니다.

## 타입과 생성 파일

- TypeScript `strict` 기준을 준수하고, `any` 남용/불필요한 타입 단언을 피합니다.
- `src/bindings.ts`는 `tauri-specta` 자동 생성 파일이므로 수동 수정하지 않습니다.
- command 시그니처 변경 시 바인딩 재생성 결과와 프런트 타입 호환성을 함께 검토합니다.

## 보안과 입력 검증

- 시크릿/토큰/개인정보를 코드·로그·문서에 노출하지 않습니다.
- Jira 토큰 저장은 secure-store/keyring 경로를 유지해야 합니다.
- Vault/파일 시스템 관련 변경은 경로 검증 로직을 유지해야 합니다.
- 경로 순회(`..`) 및 null byte 차단 로직 제거/완화는 회귀로 간주합니다.
- Jira Base URL은 `https://<org>.atlassian.net` Cloud 형식 검증을 유지합니다.
- Google OAuth 리다이렉트(`127.0.0.1:31337`)와 코드/설정 불일치를 중점 확인합니다.

## 통합 기능 회귀 포인트

- Claude 채팅: `src-tauri/src/commands/chat_ipc.rs`의 `stream-json` 파싱 전제가 깨지지 않아야 합니다.
- GitHub 활동: `gh` CLI 미설치/미인증 상황의 오류 처리와 사용자 안내를 점검합니다.
- Jira 연동: 연결 테스트와 이슈 목록 조회 흐름이 모두 유지되는지 확인합니다.
- Google Calendar: OAuth 준비/폴링/토큰 교환/이벤트 조회 흐름 단절 여부를 확인합니다.

## 품질 게이트와 완료 기준

- 변경 후 최소 `bun run check`와 `bun run build` 통과 가능성을 기준으로 리뷰합니다.
- 성능 관점에서 불필요한 렌더링, 과도한 Zustand 구독, 큰 노트 처리 지연 가능성을 점검합니다.
- 사용자 영향 변경은 모니터링/롤백 고려사항 누락 여부까지 확인합니다.

## 문서 동기화 규칙

- 아래 항목 변경 시 `CLAUDE.md` 동반 수정 필요 여부를 리뷰에서 확인합니다.
- `package.json` 실행 명령 변경
- 환경 변수 추가/변경
- Claude/GitHub/Jira/Google 통합 흐름 변경
- 생성 파일 정책 또는 최소 품질 게이트 변경
