## Why

회의 내용을 수동으로 기록하는 것은 시간이 많이 걸리고, 중요한 내용을 놓치기 쉽습니다. 회의 녹음을 자동으로 텍스트로 변환하고 요약해주는 기능이 있으면 사용자가 회의에 집중하면서도 정확한 기록을 남길 수 있습니다.

## What Changes

- 오디오 파일 업로드 및 녹음 기능 추가
- Speech-to-Text API를 통한 음성-텍스트 변환
- LLM을 활용한 회의 내용 자동 요약
- 변환된 텍스트와 요약을 vault 노트로 저장
- 회의록 전용 UI 패널 추가

## Capabilities

### New Capabilities
- `meeting-transcription`: 오디오 파일을 텍스트로 변환하는 Speech-to-Text 기능
- `meeting-summary`: 변환된 텍스트를 LLM으로 요약하는 기능
- `meeting-notes-ui`: 회의록 업로드, 변환, 요약을 위한 UI 패널

### Modified Capabilities
<!-- 기존 스펙 중 변경이 필요한 것 없음 -->

## Impact

- **프론트엔드**: 새로운 MeetingNotesPanel 컴포넌트, 오디오 업로드/녹음 UI
- **백엔드 (Rust)**: 오디오 파일 처리, API 호출을 위한 새로운 Tauri 커맨드
- **외부 의존성**: Speech-to-Text API (OpenAI Whisper 등), LLM API (요약용)
- **설정**: API 키 관리 추가
