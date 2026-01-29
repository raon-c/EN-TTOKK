## Context

현재 `ChatPanel.tsx`에는 textarea에 대한 `textareaRef`가 이미 존재하며, 자동 높이 조정에 사용되고 있다. 채팅 패널의 열림 상태는 `EditorLayout.tsx`에서 `useSidebar` 훅의 `open` 상태와 `rightSidebarTab` 상태로 관리된다.

현재 흐름:
1. 사용자가 채팅 아이콘 클릭 또는 `Ctrl+I` 입력
2. `handleTabClick("chat")` → `setOpen(true)` + `setRightSidebarTab("chat")`
3. `ChatPanel` 렌더링
4. (포커스 없음 - 사용자가 직접 클릭해야 함)

## Goals / Non-Goals

**Goals:**
- 채팅 패널이 열릴 때 textarea에 자동 포커스
- 다른 탭에서 채팅 탭으로 전환 시 자동 포커스
- 키보드 단축키(`Ctrl+I`)로 열 때 자동 포커스

**Non-Goals:**
- 채팅 패널이 이미 열려 있는 상태에서 포커스 관리
- 모바일/터치 디바이스 지원
- 다른 사이드바 탭의 포커스 관리

## Decisions

### Decision 1: ChatPanel 내부에서 useEffect로 포커스 처리

**선택**: `ChatPanel` 컴포넌트에 `isVisible` prop을 전달하고, `useEffect`로 포커스 처리

**대안 고려:**
1. ❌ `EditorLayout`에서 ref forwarding으로 직접 포커스 호출 - 컴포넌트 간 결합도 증가
2. ❌ Context로 포커스 트리거 전달 - 단순한 기능에 과도한 구조
3. ✅ `isVisible` prop + `useEffect` - 단순하고 컴포넌트 자율성 유지

**근거**: ChatPanel이 자신의 포커스를 스스로 관리하는 것이 응집도가 높고 유지보수가 용이함

### Decision 2: 포커스 타이밍

**선택**: `requestAnimationFrame` 또는 짧은 `setTimeout`으로 렌더링 완료 후 포커스

**근거**: 패널 열림 애니메이션이 진행 중일 때 즉시 포커스하면 레이아웃이 불안정할 수 있음. 한 프레임 지연으로 안정적인 포커스 보장.

## Risks / Trade-offs

- **[Risk]** 스트리밍 중이거나 Claude CLI 미설치 상태에서 포커스 시도 → textarea가 disabled 상태일 때는 포커스하지 않음
- **[Risk]** 사용자가 다른 곳에 포커스를 두고 싶은 경우 → 패널이 "열릴 때"만 포커스하므로, 이후 사용자 상호작용에 영향 없음
