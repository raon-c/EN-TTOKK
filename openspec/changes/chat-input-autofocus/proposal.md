## Why

우측 사이드바에서 채팅 탭을 클릭하여 사이드패널이 열릴 때 채팅 input textarea에 자동으로 포커스가 가지 않아 사용자가 수동으로 클릭해야 하는 불편함이 있다. 채팅 패널이 열리면 바로 메시지를 입력할 수 있도록 UX를 개선한다.

## What Changes

- 채팅 패널이 열릴 때 textarea에 자동 포커스 적용
- `Ctrl+I` (또는 `Cmd+I`) 단축키로 채팅 패널을 열 때도 자동 포커스 적용
- 사이드바 탭 전환으로 채팅 패널이 표시될 때 자동 포커스 적용

## Capabilities

### New Capabilities

- `chat-input-autofocus`: 채팅 패널이 열릴 때 input textarea에 자동으로 포커스를 설정하는 기능

### Modified Capabilities

(없음 - 기존 spec 변경 없음)

## Impact

- `apps/desktop-app/src/features/chat/components/ChatPanel.tsx`: textarea ref를 활용한 포커스 로직 추가
- `apps/desktop-app/src/layouts/EditorLayout.tsx`: 채팅 패널 열림 상태 감지 및 포커스 트리거 연동
