import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

import { commands } from "@/bindings";

import type {
  RealtimePartialResult,
  RealtimeStatus,
  RealtimeStatusEvent,
} from "../types";

type UseRealtimeTranscriptionReturn = {
  status: RealtimeStatus;
  partialText: string;
  finalText: string;
  segments: string[];
  error: string | null;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<string>;
};

// Audio processing constants
const SAMPLE_RATE = 16000; // Whisper expects 16kHz
const BROWSER_SAMPLE_RATE = 48000; // Common browser sample rate
const BUFFER_SIZE = 4096; // ScriptProcessorNode buffer size
const SEND_INTERVAL_MS = 100; // Send chunks every 100ms

export function useRealtimeTranscription(): UseRealtimeTranscriptionReturn {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [partialText, setPartialText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [segments, setSegments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sampleBufferRef = useRef<number[]>([]);
  const sendIntervalRef = useRef<number | null>(null);
  const unlistenPartialRef = useRef<UnlistenFn | null>(null);
  const unlistenStatusRef = useRef<UnlistenFn | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    sampleBufferRef.current = [];
  }, []);

  // Setup event listeners
  useEffect(() => {
    const setupListeners = async () => {
      // Listen for partial results
      unlistenPartialRef.current = await listen<RealtimePartialResult>(
        "realtime-transcription-partial",
        (event) => {
          const { text, is_final } = event.payload;

          if (is_final) {
            setFinalText(text);
            setPartialText("");
          } else {
            setPartialText(text);
            setSegments((prev) => [...prev, text]);
          }
        }
      );

      // Listen for status updates
      unlistenStatusRef.current = await listen<RealtimeStatusEvent>(
        "realtime-transcription-status",
        (event) => {
          const { status: newStatus, message } = event.payload;

          switch (newStatus) {
            case "initializing":
              setStatus("initializing");
              break;
            case "ready":
              setStatus("streaming");
              break;
            case "stopped":
              setStatus("idle");
              break;
            case "error":
              setStatus("error");
              setError(message ?? "Unknown error");
              break;
          }
        }
      );
    };

    void setupListeners();

    return () => {
      if (unlistenPartialRef.current) {
        unlistenPartialRef.current();
      }
      if (unlistenStatusRef.current) {
        unlistenStatusRef.current();
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Downsample from browser sample rate to 16kHz
  const downsample = useCallback(
    (buffer: Float32Array, inputSampleRate: number): number[] => {
      if (inputSampleRate === SAMPLE_RATE) {
        return Array.from(buffer);
      }

      const ratio = inputSampleRate / SAMPLE_RATE;
      const newLength = Math.floor(buffer.length / ratio);
      const result: number[] = [];

      for (let i = 0; i < newLength; i++) {
        const srcIndex = Math.floor(i * ratio);
        result.push(buffer[srcIndex]);
      }

      return result;
    },
    []
  );

  // Send accumulated audio samples to backend
  const sendAudioChunk = useCallback(async () => {
    if (sampleBufferRef.current.length === 0) {
      return;
    }

    const samples = [...sampleBufferRef.current];
    sampleBufferRef.current = [];

    try {
      await commands.pushAudioChunk(samples);
    } catch (err) {
      console.error("Failed to push audio chunk:", err);
    }
  }, []);

  const startStreaming = useCallback(async () => {
    setError(null);
    setPartialText("");
    setFinalText("");
    setSegments([]);
    setStatus("initializing");

    try {
      // Start real-time transcription on backend
      const result = await commands.startRealtimeTranscription(null);

      if (result.status === "error") {
        throw new Error(result.error);
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: BROWSER_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext({
        sampleRate: BROWSER_SAMPLE_RATE,
      });
      audioContextRef.current = audioContext;

      // Create source from microphone
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Create script processor for audio processing
      // Note: ScriptProcessorNode is deprecated but AudioWorklet requires
      // additional setup (separate file). Using ScriptProcessorNode for simplicity.
      const processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer.getChannelData(0);
        const downsampled = downsample(inputBuffer, audioContext.sampleRate);
        sampleBufferRef.current.push(...downsampled);
      };

      // Connect nodes
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Start sending chunks at regular intervals
      sendIntervalRef.current = window.setInterval(
        sendAudioChunk,
        SEND_INTERVAL_MS
      );

      setStatus("streaming");
    } catch (err) {
      cleanup();
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start streaming";

      if (
        errorMessage.includes("Permission denied") ||
        errorMessage.includes("NotAllowedError")
      ) {
        setError(
          "마이크 권한이 필요합니다. 시스템 설정에서 권한을 허용해주세요."
        );
      } else {
        setError(errorMessage);
      }

      setStatus("error");
    }
  }, [cleanup, downsample, sendAudioChunk]);

  const stopStreaming = useCallback(async (): Promise<string> => {
    setStatus("stopping");

    // Stop audio processing
    cleanup();

    try {
      // Send any remaining samples
      if (sampleBufferRef.current.length > 0) {
        await commands.pushAudioChunk(sampleBufferRef.current);
        sampleBufferRef.current = [];
      }

      // Stop real-time transcription on backend
      const result = await commands.stopRealtimeTranscription();

      if (result.status === "error") {
        throw new Error(result.error);
      }

      setStatus("idle");
      return result.data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to stop streaming";
      setError(errorMessage);
      setStatus("error");
      return "";
    }
  }, [cleanup]);

  return {
    status,
    partialText,
    finalText,
    segments,
    error,
    startStreaming,
    stopStreaming,
  };
}
