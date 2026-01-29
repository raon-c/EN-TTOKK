## 1. ChatPanel 컴포넌트 수정

- [x] 1.1 ChatPanel에 `isVisible` prop 추가 (optional boolean)
- [x] 1.2 `isVisible`이 true로 변경될 때 textarea에 포커스하는 useEffect 추가
- [x] 1.3 포커스 시 textarea가 disabled 상태인지 확인하는 조건 추가

## 2. EditorLayout 연동

- [x] 2.1 ChatPanel에 `isVisible` prop 전달 (rightSidebarTab === "chat" && open)

## 3. 검증

- [x] 3.1 사이드바 버튼 클릭으로 채팅 패널 열 때 포커스 확인
- [x] 3.2 Ctrl+I 단축키로 채팅 패널 열 때 포커스 확인
- [x] 3.3 다른 탭에서 채팅 탭으로 전환 시 포커스 확인
- [x] 3.4 스트리밍 중일 때 포커스 안 되는지 확인
