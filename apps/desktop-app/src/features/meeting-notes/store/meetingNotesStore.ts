import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { create } from "zustand";

import type { MeetingNotesState, MeetingSummary } from "../types";

// Tauri command types
type ModelStatus = {
  is_installed: boolean;
  model_path: string | null;
  model_size: number | null;
};

type TranscriptionResult = {
  text: string;
  duration_ms: number;
};

// Tauri command wrappers
const checkWhisperModel = () => invoke<ModelStatus>("check_whisper_model");
const downloadWhisperModel = () => invoke<void>("download_whisper_model");
const cancelWhisperDownload = () => invoke<void>("cancel_whisper_download");
const cleanupPartialDownload = () => invoke<void>("cleanup_partial_download");
const transcribeAudioCmd = (filePath: string) =>
  invoke<TranscriptionResult>("transcribe_audio", { filePath });
const cancelTranscriptionCmd = () => invoke<void>("cancel_transcription");
const saveRecordedAudioCmd = (audioData: number[]) =>
  invoke<{ file_path: string; file_size: number }>("save_recorded_audio", {
    audioData,
  });
const cleanupRecordingCmd = (filePath: string) =>
  invoke<void>("cleanup_recording", { filePath });

type RecordingFile = {
  file_path: string;
  file_name: string;
  file_size: number;
  created_at: number;
};

const listRecordingsCmd = () => invoke<RecordingFile[]>("list_recordings");

type DownloadProgressPayload = {
  downloaded: number;
  total: number;
  progress: number;
};

type TranscriptionProgressPayload = {
  progress: number;
  message: string | null;
};

type MeetingNotesStoreState = MeetingNotesState & {
  // Event listeners
  unlistenDownload: UnlistenFn | null;
  unlistenTranscription: UnlistenFn | null;

  // Model actions
  checkModelStatus: () => Promise<void>;
  downloadModel: () => Promise<void>;
  cancelDownload: () => Promise<void>;

  // Recording actions
  setRecordingStatus: (status: MeetingNotesState["recordingStatus"]) => void;
  setRecordingDuration: (duration: number) => void;
  saveRecordedAudio: (audioData: ArrayBuffer) => Promise<string>;
  cleanupRecording: () => Promise<void>;
  transcribeRecording: () => Promise<void>;

  // Recordings list
  recordings: RecordingFile[];
  isLoadingRecordings: boolean;
  loadRecordings: () => Promise<void>;
  deleteRecording: (filePath: string) => Promise<void>;

  // Transcription actions
  transcribeAudio: (filePath: string) => Promise<void>;
  cancelTranscription: () => void;
  setTranscript: (text: string | null) => void;

  // Summary actions
  generateSummary: () => Promise<void>;

  // Save actions
  saveNote: (title: string, includeTranscript: boolean) => Promise<void>;

  // Event setup
  setupEventListeners: () => Promise<void>;
  cleanupEventListeners: () => void;

  // Reset
  reset: () => void;
};

const initialState: MeetingNotesState = {
  // Model state
  modelStatus: "unknown",
  downloadProgress: 0,
  isDownloading: false,

  // Recording state
  recordingStatus: "idle",
  recordingDuration: 0,
  recordedFilePath: null,

  // Transcription state
  transcriptionStatus: "idle",
  transcriptionProgress: 0,
  transcript: null,
  audioFileName: null,

  // Summary state
  summaryStatus: "idle",
  summary: null,

  // Error state
  error: null,
};

export const useMeetingNotesStore = create<MeetingNotesStoreState>(
  (set, get) => ({
    ...initialState,
    unlistenDownload: null,
    unlistenTranscription: null,
    recordings: [],
    isLoadingRecordings: false,

    setupEventListeners: async () => {
      // Download progress listener
      const unlistenDownload = await listen<DownloadProgressPayload>(
        "whisper-download-progress",
        (event) => {
          set({ downloadProgress: event.payload.progress });
        }
      );

      // Transcription progress listener
      const unlistenTranscription = await listen<TranscriptionProgressPayload>(
        "whisper-transcription-progress",
        (event) => {
          set({ transcriptionProgress: event.payload.progress });
        }
      );

      set({ unlistenDownload, unlistenTranscription });
    },

    cleanupEventListeners: () => {
      const { unlistenDownload, unlistenTranscription } = get();
      unlistenDownload?.();
      unlistenTranscription?.();
      set({ unlistenDownload: null, unlistenTranscription: null });
    },

    checkModelStatus: async () => {
      set({ modelStatus: "checking", error: null });
      try {
        const status = await checkWhisperModel();
        set({
          modelStatus: status.is_installed ? "ready" : "not_installed",
        });
      } catch (error) {
        set({
          modelStatus: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to check model status",
        });
      }
    },

    downloadModel: async () => {
      set({
        isDownloading: true,
        downloadProgress: 0,
        modelStatus: "downloading",
        error: null,
      });

      try {
        await downloadWhisperModel();
        set({
          isDownloading: false,
          downloadProgress: 100,
          modelStatus: "ready",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Download failed";
        // Don't show error for cancellation
        if (errorMessage.includes("cancelled")) {
          set({
            isDownloading: false,
            downloadProgress: 0,
            modelStatus: "not_installed",
          });
        } else {
          set({
            isDownloading: false,
            downloadProgress: 0,
            modelStatus: "error",
            error: errorMessage,
          });
        }
      }
    },

    cancelDownload: async () => {
      cancelWhisperDownload();
      try {
        await cleanupPartialDownload();
      } catch {
        // Ignore cleanup errors
      }
      set({
        isDownloading: false,
        downloadProgress: 0,
        modelStatus: "not_installed",
      });
    },

    setRecordingStatus: (status) => {
      set({ recordingStatus: status });
    },

    setRecordingDuration: (duration) => {
      set({ recordingDuration: duration });
    },

    saveRecordedAudio: async (audioData: ArrayBuffer) => {
      try {
        // Convert ArrayBuffer to array of numbers for Tauri
        const uint8Array = new Uint8Array(audioData);
        const audioArray = Array.from(uint8Array);

        const result = await saveRecordedAudioCmd(audioArray);
        set({ recordedFilePath: result.file_path });
        return result.file_path;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to save recording";
        set({ error: errorMessage, recordingStatus: "error" });
        throw error;
      }
    },

    cleanupRecording: async () => {
      const { recordedFilePath } = get();
      if (recordedFilePath) {
        try {
          await cleanupRecordingCmd(recordedFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
      set({
        recordingStatus: "idle",
        recordingDuration: 0,
        recordedFilePath: null,
      });
    },

    transcribeRecording: async () => {
      const { recordedFilePath, modelStatus, transcribeAudio } = get();

      if (!recordedFilePath) {
        set({ error: "No recording to transcribe" });
        return;
      }

      if (modelStatus !== "ready") {
        set({ error: "Model not ready" });
        return;
      }

      await transcribeAudio(recordedFilePath);
    },

    loadRecordings: async () => {
      set({ isLoadingRecordings: true });
      try {
        const recordings = await listRecordingsCmd();
        set({ recordings, isLoadingRecordings: false });
      } catch (error) {
        set({
          isLoadingRecordings: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load recordings",
        });
      }
    },

    deleteRecording: async (filePath: string) => {
      try {
        await cleanupRecordingCmd(filePath);
        const { recordings } = get();
        set({ recordings: recordings.filter((r) => r.file_path !== filePath) });
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete recording",
        });
      }
    },

    transcribeAudio: async (filePath: string) => {
      set({
        transcriptionStatus: "transcribing",
        transcriptionProgress: 0,
        transcript: null,
        audioFileName: filePath.split("/").pop() ?? null,
        error: null,
      });

      try {
        const result = await transcribeAudioCmd(filePath);
        set({
          transcriptionStatus: "completed",
          transcriptionProgress: 100,
          transcript: result.text,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Transcription failed";
        if (errorMessage.includes("cancelled")) {
          set({
            transcriptionStatus: "cancelled",
            transcriptionProgress: 0,
          });
        } else {
          set({
            transcriptionStatus: "error",
            transcriptionProgress: 0,
            error: errorMessage,
          });
        }
      }
    },

    cancelTranscription: () => {
      cancelTranscriptionCmd();
      set({
        transcriptionStatus: "cancelled",
        transcriptionProgress: 0,
      });
    },

    setTranscript: (text: string | null) => {
      set({
        transcript: text,
        transcriptionStatus: text ? "completed" : "idle",
        transcriptionProgress: text ? 100 : 0,
      });
    },

    generateSummary: async () => {
      const { transcript } = get();
      if (!transcript) {
        set({ error: "No transcript available" });
        return;
      }

      set({ summaryStatus: "generating", error: null });

      // TODO: Integrate with existing Chat LLM infrastructure
      // For now, create a placeholder implementation
      try {
        // Simulate LLM call - replace with actual implementation
        const summary: MeetingSummary = {
          keyPoints: ["요약 기능이 아직 구현되지 않았습니다."],
          decisions: [],
          actionItems: [],
        };

        set({
          summaryStatus: "completed",
          summary,
        });
      } catch (error) {
        set({
          summaryStatus: "error",
          error:
            error instanceof Error
              ? error.message
              : "Summary generation failed",
        });
      }
    },

    saveNote: async (_title: string, _includeTranscript: boolean) => {
      const { transcript, summary } = get();
      if (!transcript && !summary) {
        set({ error: "No content to save" });
        return;
      }

      // TODO: Implement with vault save using existing write_file command
      // This will be implemented in a later task
    },

    reset: () => {
      const { cleanupEventListeners } = get();
      cleanupEventListeners();
      set({
        ...initialState,
        unlistenDownload: null,
        unlistenTranscription: null,
      });
    },
  })
);
