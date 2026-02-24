import { useCallback, useEffect, useState } from "react";
import { normalizeAppError } from "@/lib/platform";
import { apiClient } from "../lib/api-client";

export type BackendStatus = "connecting" | "connected" | "error";

interface UseBackendResult {
  status: BackendStatus;
  error: string | null;
  lastChecked: Date | null;
  retry: () => void;
  checkHealth: () => Promise<void>;
}

export function useBackend(): UseBackendResult {
  const [status, setStatus] = useState<BackendStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      await apiClient.healthCheck();
      setStatus("connected");
      setError(null);
      setLastChecked(new Date());
    } catch (error) {
      const appError = normalizeAppError(
        error,
        "Failed to connect to app service"
      );
      setStatus("error");
      setError(`${appError.message} (trace: ${appError.traceId})`);
      setLastChecked(new Date());
    }
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);

    const connected = await apiClient.waitForBackend();

    if (connected) {
      setStatus("connected");
      setLastChecked(new Date());
    } else {
      setStatus("error");
      setError("Failed to connect to app service");
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    connect();
  }, [connect]);

  return {
    status,
    error,
    lastChecked,
    retry: connect,
    checkHealth,
  };
}
