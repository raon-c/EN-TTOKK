# 기술 스택

## 빌드 시스템 및 패키지 매니저
- **Bun**: 주요 런타임 및 패키지 매니저
- **워크스페이스**: `packages/*`와 `apps/*`를 포함한 모노레포
- **Biome**: 린팅, 포매팅, 코드 품질 관리

## 프론트엔드 스택
- **React 19**: 최신 기능을 포함한 UI 프레임워크
- **TypeScript**: Strict 모드 활성화, ES2020 타겟
- **Vite**: 빌드 도구 및 개발 서버 (포트 1420)
- **Tailwind CSS v4**: 커스텀 디자인 시스템을 포함한 스타일링
- **Radix UI**: 접근성을 고려한 컴포넌트 프리미티브
- **TipTap**: 확장 기능을 포함한 리치 텍스트 에디터
- **Zustand**: 상태 관리
- **React Hook Form**: Zod 검증을 포함한 폼 처리

## 백엔드 스택
- **Tauri 2.x**: 데스크톱 앱 프레임워크 (Rust)
- **Hono**: API 서버용 웹 프레임워크
- **Bun**: 백엔드 서비스 런타임 (포트 31337)

## 주요 라이브러리
- **Effect**: 함수형 프로그래밍 유틸리티
- **Zod**: 스키마 검증
- **date-fns**: 날짜 조작
- **Lucide React**: 아이콘 시스템

## 주요 명령어

### 개발
```bash
# 의존성 설치
bun install

# 데스크톱 앱 시작 (풀스택)
cd apps/desktop-app && bun run tauri:dev

# 프론트엔드만
cd apps/desktop-app && bun run dev

# 백엔드만
bun run backend:dev
```

### 코드 품질
```bash
# 린트 및 포맷
bun run check:fix

# 타입 검사
cd apps/desktop-app && bunx tsc --noEmit
```

### 빌드
```bash
# 데스크톱 앱 빌드
cd apps/desktop-app && bun run tauri:build

# 백엔드 빌드
bun run backend:build
```

## 설정 파일
- `biome.json`: 코드 포매팅 및 린팅 규칙
- `tsconfig.json`: TypeScript 컴파일러 옵션
- `tauri.conf.json`: 데스크톱 앱 설정
- `vite.config.ts`: 프론트엔드 빌드 설정