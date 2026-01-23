import type { HealthResponse } from "@enttokk/api-types";

const BACKEND_PORT = 31337;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

interface FetchOptions extends RequestInit {
  timeout?: number;
}

async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 5000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  async healthCheck(): Promise<HealthResponse> {
    const response = await fetchWithTimeout(`${BACKEND_URL}/healthz`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  },

  async waitForBackend(maxRetries = 30, retryDelay = 500): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.healthCheck();
        return true;
      } catch {
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }
    return false;
  },
};
