# 프로젝트 구조

## 모노레포 구성

```
bun-enttokk/
├── apps/
│   ├── backend/              # Bun API 서버
│   │   ├── src/
│   │   │   ├── index.ts      # 서버 진입점
│   │   │   ├── lib/          # 공유 유틸리티
│   │   │   ├── routes/       # API 라우트 핸들러
│   │   │   └── services/     # 비즈니스 로직
│   │   └── tests/            # 백엔드 테스트
│   └── desktop-app/          # Tauri 데스크톱 애플리케이션
│       ├── src/              # React 프론트엔드
│       │   ├── components/   # 재사용 가능한 UI 컴포넌트
│       │   ├── features/     # 기능 기반 모듈
│       │   ├── hooks/        # 커스텀 React 훅
│       │   ├── layouts/      # 페이지 레이아웃
│       │   ├── lib/          # 프론트엔드 유틸리티
│       │   └── types/        # TypeScript 정의
│       └── src-tauri/        # Rust 백엔드
│           └── src/
│               ├── commands/ # Tauri IPC 명령어
│               └── main.rs   # Rust 진입점
└── packages/
    ├── api-types/            # 공유 TypeScript 타입
    └── shared/               # 공통 유틸리티
```

## 기능 구성

프론트엔드 기능들은 일관된 구조를 따릅니다:

```
src/features/{기능명}/
├── components/               # 기능별 컴포넌트
├── hooks/                   # 기능별 훅
├── store/                   # Zustand 상태 관리
├── types.ts                 # 기능 타입 정의
└── index.ts                 # 공개 API 내보내기
```

## 주요 디렉토리

### 설정
- `.claude/`: Claude AI 어시스턴트 설정
- `.kiro/`: Kiro IDE 스티어링 규칙
- `.sisyphus/`: 프로젝트 계획 및 노트

### 프론트엔드 컴포넌트
- `src/components/ui/`: Radix UI 기반 디자인 시스템
- `src/components/ai-elements/`: AI 전용 UI 컴포넌트
- `src/features/`: 기능 모듈 (채팅, 캘린더, Jira 등)

### 백엔드 구조
- `src/routes/`: HTTP 라우트 핸들러
- `src/services/`: 비즈니스 로직 및 통합
- `src/lib/`: 공유 백엔드 유틸리티

## 네이밍 컨벤션

- **파일**: 디렉토리는 kebab-case, React 컴포넌트는 PascalCase
- **컴포넌트**: 설명적인 이름의 PascalCase
- **훅**: "use"로 시작하는 camelCase
- **타입**: 설명적인 접미사를 포함한 PascalCase
- **상수**: UPPER_SNAKE_CASE

## 임포트 패턴

- src 디렉토리 임포트에는 `@/` 별칭 사용
- 워크스페이스 패키지: `@enttokk/api-types`, `@bun-enttokk/shared`
- index.ts 파일을 통한 기능 내보내기
- 같은 기능 내 파일들은 상대 임포트 사용