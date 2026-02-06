import { useCallback, useEffect, useRef, useState } from "react";

import { useMeetingNotesStore } from "../store/meetingNotesStore";

type UseAudioRecorderReturn = {
  isRecording: boolean;
  duration: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
};

export function useAudioRecorder(): UseAudioRecorderReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const setRecordingStatus = useMeetingNotesStore((s) => s.setRecordingStatus);
  const setRecordingDuration = useMeetingNotesStore(
    (s) => s.setRecordingDuration
  );
  const saveRecordedAudio = useMeetingNotesStore((s) => s.saveRecordedAudio);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setRecordingStatus("requesting_permission");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second

      setIsRecording(true);
      setDuration(0);
      setRecordingStatus("recording");
      setRecordingDuration(0);

      // Start duration timer
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          setRecordingDuration(newDuration);
          return newDuration;
        });
      }, 1000);
    } catch (err) {
      cleanup();
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start recording";

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

      setRecordingStatus("error");
    }
  }, [cleanup, setRecordingStatus, setRecordingDuration]);

  const stopRecording = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      return;
    }

    setRecordingStatus("stopping");

    return new Promise<void>((resolve, reject) => {
      mediaRecorder.onstop = async () => {
        try {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const arrayBuffer = await blob.arrayBuffer();

          await saveRecordedAudio(arrayBuffer);

          setIsRecording(false);
          setRecordingStatus("completed");

          // Cleanup stream but keep the recorded file path
          if (streamRef.current) {
            for (const track of streamRef.current.getTracks()) {
              track.stop();
            }
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
          chunksRef.current = [];

          resolve();
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to save recording";
          setError(errorMessage);
          setRecordingStatus("error");
          cleanup();
          reject(err);
        }
      };

      mediaRecorder.stop();
    });
  }, [cleanup, saveRecordedAudio, setRecordingStatus]);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    cleanup();
    setIsRecording(false);
    setDuration(0);
    setRecordingStatus("idle");
    setRecordingDuration(0);
  }, [cleanup, setRecordingStatus, setRecordingDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
