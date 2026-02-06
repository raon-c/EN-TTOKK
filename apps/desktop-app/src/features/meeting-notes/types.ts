export type ModelStatus =
  | "unknown"
  | "checking"
  | "not_installed"
  | "downloading"
  | "ready"
  | "error";

export type TranscriptionStatus =
  | "idle"
  | "transcribing"
  | "completed"
  | "cancelled"
  | "error";

export type SummaryStatus = "idle" | "generating" | "completed" | "error";

export type RecordingStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "stopping"
  | "completed"
  | "error";

export type MeetingNotesState = {
  // Model state
  modelStatus: ModelStatus;
  downloadProgress: number;
  isDownloading: boolean;

  // Recording state
  recordingStatus: RecordingStatus;
  recordingDuration: number; // in seconds
  recordedFilePath: string | null;

  // Transcription state
  transcriptionStatus: TranscriptionStatus;
  transcriptionProgress: number;
  transcript: string | null;
  audioFileName: string | null;

  // Summary state
  summaryStatus: SummaryStatus;
  summary: MeetingSummary | null;

  // Error state
  error: string | null;
};

export type MeetingSummary = {
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
};

export type ActionItem = {
  description: string;
  assignee?: string;
  dueDate?: string;
};

export type TranscriptionProgress = {
  progress: number;
  message?: string;
};

export type DownloadProgress = {
  downloaded: number;
  total: number;
  progress: number;
};

export type SupportedAudioFormat = "mp3" | "wav" | "m4a" | "webm";

export const SUPPORTED_AUDIO_EXTENSIONS: readonly SupportedAudioFormat[] = [
  "mp3",
  "wav",
  "m4a",
  "webm",
] as const;

export const isValidAudioFile = (fileName: string): boolean => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.includes(extension as SupportedAudioFormat);
};

// Real-time transcription types
export type RealtimeStatus =
  | "idle"
  | "initializing"
  | "streaming"
  | "paused"
  | "stopping"
  | "error";

export type RealtimePartialResult = {
  text: string;
  is_final: boolean;
  segment_index: number;
};

export type RealtimeStatusEvent = {
  status: string;
  message?: string;
};
