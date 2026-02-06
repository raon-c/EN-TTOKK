# Tasks: add-meeting-notes

## 1. 프로젝트 설정

- [x] 1.1 Cargo.toml에 whisper-rs 의존성 추가
- [x] 1.2 프론트엔드 feature 디렉토리 구조 생성 (src/features/meeting-notes/)
- [x] 1.3 meetingNotesStore.ts 스토어 파일 생성
- [x] 1.4 types.ts 타입 정의 파일 생성

## 2. Rust 백엔드 - 모델 관리

- [x] 2.1 모델 존재 여부 확인 Tauri 커맨드 구현 (check_whisper_model)
- [x] 2.2 모델 다운로드 Tauri 커맨드 구현 (download_whisper_model)
- [x] 2.3 다운로드 진행률 이벤트 emit 구현
- [x] 2.4 다운로드 취소 기능 구현
- [x] 2.5 부분 다운로드 파일 정리 로직 추가

## 3. Rust 백엔드 - STT 변환

- [x] 3.1 오디오 파일 형식 검증 함수 구현 (.mp3, .wav, .m4a, .webm)
- [x] 3.2 whisper-rs를 사용한 STT 변환 Tauri 커맨드 구현 (transcribe_audio)
- [x] 3.3 변환 진행률 이벤트 emit 구현
- [x] 3.4 변환 취소 기능 구현
- [x] 3.5 한국어 언어 설정 적용

## 4. Rust 백엔드 - TypeScript 바인딩

- [x] 4.1 새 커맨드들을 lib.rs의 invoke_handler에 등록
- [x] 4.2 tauri-specta로 TypeScript 바인딩 생성 확인

## 5. 프론트엔드 - 상태 관리

- [x] 5.1 Zustand 스토어에 모델 상태 관리 추가 (isModelReady, isDownloading)
- [x] 5.2 변환 상태 관리 추가 (isTranscribing, progress, transcript)
- [x] 5.3 요약 상태 관리 추가 (isSummarizing, summary)
- [x] 5.4 Tauri 이벤트 리스너 연결 (진행률 업데이트)

## 6. 프론트엔드 - 모델 다운로드 UI

- [x] 6.1 모델 미설치 상태 안내 컴포넌트 구현
- [x] 6.2 다운로드 버튼 및 프로그레스 바 구현
- [x] 6.3 다운로드 취소 버튼 구현
- [x] 6.4 모델 준비 완료 상태 표시 구현

## 7. 프론트엔드 - 파일 업로드 UI

- [x] 7.1 드래그앤드롭 영역 컴포넌트 구현
- [x] 7.2 파일 선택 버튼 및 다이얼로그 연동
- [x] 7.3 지원 파일 형식 필터 적용
- [x] 7.4 모델 미설치 시 업로드 비활성화 처리

## 8. 프론트엔드 - 변환 및 요약 UI

- [x] 8.1 STT 변환 진행률 프로그레스 바 구현
- [x] 8.2 변환 취소 버튼 구현
- [x] 8.3 전사본 미리보기 영역 구현 (스크롤 가능)
- [x] 8.4 요약 생성 로딩 인디케이터 구현
- [x] 8.5 요약 결과 표시 영역 구현

## 9. 프론트엔드 - 요약 기능

- [x] 9.1 기존 Chat LLM 인프라 연동
- [x] 9.2 회의록 요약 프롬프트 작성 (핵심 내용, 결정 사항, 액션 아이템)
- [x] 9.3 API 키 미설정 시 설정 화면 안내 구현

## 10. 프론트엔드 - 노트 저장

- [x] 10.1 노트 제목 입력 필드 구현 (기본값: "회의록-{날짜}")
- [x] 10.2 저장 옵션 선택 UI 구현 (요약만 / 전체)
- [x] 10.3 마크다운 노트 생성 및 vault 저장 로직 구현
- [x] 10.4 저장 성공/실패 토스트 메시지 구현

## 11. MeetingNotesPanel 통합

- [x] 11.1 MeetingNotesPanel.tsx 컴포넌트 조립
- [x] 11.2 사이드바에 회의록 아이콘 및 네비게이션 추가
- [x] 11.3 index.ts export 정리

## 12. 실시간 녹음 기능

- [x] 12.1 Rust 백엔드 - 녹음 데이터 저장 커맨드 구현 (save_recorded_audio)
- [x] 12.2 프론트엔드 - 녹음 상태 타입 및 스토어 추가
- [x] 12.3 프론트엔드 - MediaRecorder API 훅 구현 (useAudioRecorder)
- [x] 12.4 프론트엔드 - 녹음 UI 컴포넌트 구현 (RecordingSection)
- [x] 12.5 녹음 시작/중지/취소 버튼 구현
- [x] 12.6 녹음 경과 시간 표시 구현
- [x] 12.7 마이크 권한 요청 및 에러 핸들링
- [x] 12.8 녹음 완료 후 변환 연동

## 13. 테스트 및 검증

- [x] 13.1 모델 다운로드 flow 테스트
- [x] 13.2 오디오 파일 변환 테스트 (각 형식별)
- [x] 13.3 요약 생성 테스트
- [x] 13.4 노트 저장 테스트
- [x] 13.5 에러 케이스 테스트 (미지원 형식, 네트워크 오류 등)
- [ ] 13.6 녹음 기능 테스트
