# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

React 19 프론트엔드와 Rust 백엔드로 구성된 Tauri 2.x 데스크톱 애플리케이션을 포함한 Bun 모노레포입니다.

## 명령어

별도 표기가 없으면 저장소 루트에서 실행합니다.

```bash
# 의존성 설치
bun install

# 개발 모드 (Vite 개발 서버 + Tauri 동시 실행)
cd apps/desktop-app && bun run tauri dev

# 프로덕션 빌드
cd apps/desktop-app && bun run tauri build

# 프론트엔드만 실행 (Vite 개발 서버, 포트 1420)
cd apps/desktop-app && bun run dev

# TypeScript 타입 검사
cd apps/desktop-app && bunx tsc --noEmit
```

## 아키텍처

```tree
bun-enttokk/
├── apps/desktop-app/       # Tauri 데스크톱 애플리케이션
│   ├── src/                # React TypeScript 프론트엔드
│   │   ├── App.tsx         # 메인 React 컴포넌트
│   │   └── main.tsx        # 진입점
│   ├── src-tauri/          # Rust 백엔드
│   │   ├── src/lib.rs      # Tauri 커맨드 (IPC 핸들러)
│   │   ├── src/main.rs     # 진입점
│   │   └── Cargo.toml      # Rust 의존성
│   └── vite.config.ts      # Vite 번들러 설정
└── packages/shared/        # 공유 TypeScript 유틸리티
```

## Tauri IPC 패턴

프론트엔드에서 `invoke`를 통해 Rust 백엔드를 호출합니다:

```typescript
// React (프론트엔드)
import { invoke } from "@tauri-apps/api/core";
const result = await invoke("greet", { name: "World" });
```

```rust
// Rust (백엔드) - src-tauri/src/lib.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// 빌더에 등록
.invoke_handler(tauri::generate_handler![greet])
```

## TypeScript 설정

- Strict 모드 활성화 (모든 검사 포함)
- Target: ES2020
- JSX: react-jsx (자동 import)
- 모듈 해석: bundler

## 개발 참고사항

- Vite 개발 서버: `localhost:1420` (고정 포트)
- HMR 포트: 1421
- Tauri는 `src-tauri/` 디렉토리의 Rust 변경을 감지하여 자동 재빌드
- Vite는 `src-tauri/`를 감시 대상에서 제외

## 추가 규칙

`.claude/rules/` 디렉토리에서 상세 가이드라인을 참고하세요:

- `coding-style.md` - 불변성, 파일 구성
- `testing.md` - 80% 커버리지, TDD 워크플로우
- `security.md` - 시크릿 관리, 입력 검증
- `agents.md` - 사용 가능한 전문 에이전트
- `git-workflow.md` - 커밋 형식, PR 워크플로우
