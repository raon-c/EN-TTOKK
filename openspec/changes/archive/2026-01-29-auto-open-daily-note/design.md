## Context

현재 앱 시작 시 vault를 열면 `activeNote`가 `null` 상태로 빈 에디터 화면이 표시된다. 사용자는 매번 파일 탐색기나 캘린더에서 데일리 노트를 수동으로 클릭해야 한다.

기존 코드 구조:
- `App.tsx`: vault 열기 완료 후 `EditorLayout` 렌더링
- `dailyNotesStore.ts`: `openOrCreateDailyNote(date)` 함수가 이미 존재하며, 노트가 없으면 생성 후 열기 기능 제공
- `vaultStore.ts`: `activeNote` 상태로 현재 열린 노트 관리

## Goals / Non-Goals

**Goals:**
- Vault 열기 완료 시 `activeNote`가 없으면 오늘 데일리 노트 자동 열기
- 오늘 데일리 노트가 없으면 생성 후 열기
- 기존 함수 재사용으로 최소한의 코드 변경

**Non-Goals:**
- 사용자가 노트를 닫은 후 자동으로 다시 열기 (사용자 의도 존중)
- 데일리 노트 설정 변경 (폴더 경로, 템플릿 등)
- 설정으로 이 동작을 끄고 켜는 기능 (추후 별도 변경으로)

## Decisions

### 1. 자동 열기 트리거 위치

**결정**: `App.tsx`의 vault 자동 열기 로직 완료 직후에 추가

**이유**:
- vault 열기와 데일리 노트 열기가 하나의 시퀀스로 동작
- 이미 `openVault` 완료 시점이 명확히 존재
- 별도 `useEffect`보다 기존 플로우에 통합하는 것이 예측 가능

**대안 검토**:
- `EditorLayout`에서 처리 → vault 상태 변경 시마다 트리거될 위험
- `vaultStore.openVault` 내부 → store 간 의존성 복잡해짐

### 2. 열기 조건 판단

**결정**: `activeNote === null` 일 때만 자동 열기

**이유**:
- 사용자가 이미 노트를 열어둔 상태에서 앱 재시작 시 방해하지 않음
- 단순하고 명확한 조건

### 3. 기존 함수 재사용

**결정**: `dailyNotesStore.openOrCreateDailyNote(new Date())` 직접 호출

**이유**:
- 이미 "없으면 생성 후 열기" 로직 구현되어 있음
- 폴더 생성, 템플릿 적용 등 모든 처리 포함
- 중복 구현 불필요

## Risks / Trade-offs

**[위험] vault 열기 실패 시 데일리 노트 열기 시도**
→ 완화: vault 열기 성공(`openVault` Promise resolve) 후에만 실행

**[위험] 데일리 노트 열기 실패 시 에러 표시**
→ 완화: `openOrCreateDailyNote`는 이미 Effect 패턴으로 에러 처리됨. 실패해도 앱 사용에 지장 없음 (빈 에디터로 폴백)

**[트레이드오프] 설정으로 비활성화 불가**
→ 수용: 이 기능은 핵심 UX이므로 기본 동작으로 충분. 추후 필요시 별도 변경으로 설정 추가
