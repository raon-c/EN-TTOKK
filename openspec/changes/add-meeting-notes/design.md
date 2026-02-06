# Design: add-meeting-notes

## Context

현재 앱은 Tauri 2.x 데스크톱 앱으로, vault 기반 노트 관리 시스템입니다. 기존에 GitHub, Jira, Google Calendar, Claude Activity 등의 기능이 패널 형태로 구현되어 있습니다. Rust 백엔드는 `tauri-specta`를 사용해 TypeScript 바인딩을 자동 생성하며, 프론트엔드는 React 19 + Zustand 상태 관리를 사용합니다.

회의록 기능은 오디오 파일을 텍스트로 변환(STT)하고 LLM으로 요약한 후 vault 노트로 저장하는 기능입니다.

## Goals / Non-Goals

**Goals:**

- 오디오 파일(.mp3, .wav, .m4a, .webm) 업로드 지원
- **실시간 녹음 기능** (브라우저 MediaRecorder API 활용)
- 로컬 Whisper (whisper-rs)를 통한 Speech-to-Text 변환
- LLM API를 통한 회의 내용 자동 요약 (핵심 내용, 액션 아이템, 참석자 발언 등)
- 변환된 전사본과 요약을 마크다운 노트로 vault에 저장
- 기존 패널 UI 패턴과 일관된 MeetingNotesPanel 제공
- 오프라인 STT 지원 (네트워크 불필요)

**Non-Goals:**

- 화자 분리(Speaker Diarization) - Whisper 기본 기능으로 미지원
- 다국어 자동 감지 (한국어 기본, 추후 확장)
- GPU 가속 (초기 버전은 CPU만, 추후 Metal/CUDA 지원)

## Decisions

### 1. Speech-to-Text: 로컬 Whisper (whisper-rs)

**선택 이유:**

- API 비용 없음 (무료)
- 오프라인 사용 가능
- 데이터 프라이버시 보장 (외부 전송 없음)
- Rust 네이티브 통합으로 Tauri와 자연스러운 연동

**대안 검토:**

- OpenAI Whisper API: 비용 발생, 네트워크 필수, 프라이버시 우려
- Google Cloud Speech-to-Text: 복잡한 설정, 비용 발생
- Python Whisper: 별도 런타임 필요, 배포 복잡

**모델 선택: `small` (466MB)**

- `tiny` (74MB): 빠르지만 한국어 정확도 낮음
- `base` (142MB): 균형이나 여전히 정확도 부족
- `small` (466MB): 한국어 인식 정확도와 속도의 균형점 ✓
- `medium` (1.5GB): 정확도 높으나 용량/속도 부담

**구현:**

- 크레이트: `whisper-rs` (whisper.cpp Rust 바인딩)
- 모델 저장: `~/.local/share/en-ttokk/models/` (앱 데이터 디렉토리)
- 첫 실행 시 모델 다운로드 (프로그레스 표시)

### 2. 요약 API: 기존 Chat 기능의 LLM API 재사용

**선택 이유:**

- 이미 앱에 Chat 기능이 있어 LLM 연동 인프라 존재
- API 키 관리 로직 재사용 가능
- 프롬프트만 회의록 요약에 최적화

### 3. 오디오 파일 처리: Rust 백엔드에서 처리

**선택 이유:**

- 대용량 파일 처리에 Rust가 효율적
- whisper-rs가 Rust 네이티브
- 프론트엔드 메모리 부담 최소화

**구현 방식:**

```text
[프론트엔드] → [Tauri Command] → [Rust: whisper-rs로 로컬 변환]
```

### 4. 저장 형식: 마크다운 노트

**구조:**

```markdown
# 회의록: {제목}

날짜: {날짜}
파일: {원본 파일명}

## 요약

{LLM 요약 결과}

## 전사본

{Whisper 변환 결과}
```

### 5. Feature 디렉토리 구조

기존 패턴 따름:

```text
src/features/meeting-notes/
├── components/
│   └── MeetingNotesPanel.tsx
├── store/
│   └── meetingNotesStore.ts
├── types.ts
└── index.ts
```

### 6. 실시간 녹음: 브라우저 MediaRecorder API

**선택 이유:**

- 브라우저 내장 API로 별도 의존성 불필요
- Tauri WebView에서 기본 지원
- 사용자 권한 요청 자동 처리
- WebM/Opus 형식으로 고품질 녹음

**구현 방식:**

```text
[MediaRecorder] → [WebM Blob] → [Tauri: 임시 파일 저장] → [Whisper 변환]
```

**녹음 흐름:**

1. 사용자가 "녹음 시작" 버튼 클릭
2. `navigator.mediaDevices.getUserMedia()` 로 마이크 권한 요청
3. MediaRecorder로 녹음 시작 (WebM/Opus 형식)
4. 녹음 중 경과 시간 표시
5. "녹음 중지" 버튼 클릭 시 Blob 생성
6. Blob을 ArrayBuffer로 변환 후 Rust 백엔드로 전송
7. Rust에서 임시 파일로 저장 후 STT 변환

**오디오 형식:**

- 녹음: WebM/Opus (MediaRecorder 기본)
- Whisper 입력: WAV 16kHz mono (symphonia로 변환)

## Risks / Trade-offs

| 리스크                          | 완화 방안                                           |
| ------------------------------- | --------------------------------------------------- |
| 모델 다운로드 용량 (466MB)      | 첫 실행 시 안내, 프로그레스 바, 백그라운드 다운로드 |
| CPU 처리 시간 (긴 오디오)       | 프로그레스 표시, 청크 단위 처리, 취소 기능          |
| 빌드 복잡도 증가 (native 의존성) | CI/CD에 whisper.cpp 빌드 환경 구성                  |
| 메모리 사용량                   | small 모델 사용, 처리 중 UI 피드백                  |
| 긴 회의 전사본 처리             | 청크 단위 처리, 점진적 UI 업데이트                  |
| 마이크 권한 거부                | 명확한 권한 요청 안내, 설정 가이드 제공             |
| 녹음 중 브라우저 충돌           | 주기적 청크 저장, 복구 기능 고려                    |
