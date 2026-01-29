## Why

앱 시작 시 빈 화면이 표시되어 사용자가 매번 데일리 노트를 수동으로 찾아 열어야 한다. 노트 앱의 핵심 사용 패턴은 "오늘의 기록"이므로, 앱 실행 시 자동으로 오늘 날짜의 데일리 노트를 열어 즉시 작성을 시작할 수 있어야 한다.

## What Changes

- Vault 열기 완료 후 현재 열린 노트가 없으면 오늘 날짜의 데일리 노트를 자동으로 연다
- 오늘 날짜의 데일리 노트가 vault에 없으면 생성 후 연다
- 이 동작은 앱 시작 시에만 발생하며, 사용자가 노트를 닫은 경우에는 자동으로 열지 않는다

## Capabilities

### New Capabilities

- `auto-open-daily-note`: 앱 시작 시 데일리 노트 자동 열기 로직

### Modified Capabilities

(없음 - 기존 스펙 변경 없음)

## Impact

- `apps/desktop-app/src/App.tsx`: vault 열기 완료 후 자동 열기 로직 추가
- `apps/desktop-app/src/features/daily-notes/store/dailyNotesStore.ts`: `openOrCreateDailyNote` 함수 활용
- 기존 `openOrCreateDailyNote` API는 변경 없이 재사용
