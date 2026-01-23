import { useCallback, useEffect, useState } from "react";
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
    } catch {
      setStatus("error");
      setError("Failed to connect to backend server");
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
      setError("Failed to connect to backend server");
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
