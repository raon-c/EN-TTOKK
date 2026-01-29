## ADDED Requirements

### Requirement: Auto-open daily note on app start

앱 시작 시 vault가 열리고 현재 열린 노트가 없으면, 시스템은 오늘 날짜의 데일리 노트를 자동으로 열어야 한다(SHALL). 오늘 데일리 노트가 존재하지 않으면 생성 후 열어야 한다(SHALL).

#### Scenario: Daily note exists and no note is open
- **WHEN** vault 열기가 완료되고 activeNote가 null이며 오늘 날짜의 데일리 노트가 vault에 존재함
- **THEN** 시스템은 오늘 날짜의 데일리 노트를 자동으로 연다

#### Scenario: Daily note does not exist and no note is open
- **WHEN** vault 열기가 완료되고 activeNote가 null이며 오늘 날짜의 데일리 노트가 vault에 존재하지 않음
- **THEN** 시스템은 오늘 날짜의 데일리 노트를 생성한 후 자동으로 연다

#### Scenario: Note is already open
- **WHEN** vault 열기가 완료되고 activeNote가 이미 존재함
- **THEN** 시스템은 자동 열기를 수행하지 않고 현재 열린 노트를 유지한다

#### Scenario: Daily note open fails
- **WHEN** vault 열기가 완료되고 데일리 노트 열기/생성이 실패함
- **THEN** 시스템은 에러를 조용히 처리하고 빈 에디터 상태로 유지한다 (앱 사용에 지장 없음)
