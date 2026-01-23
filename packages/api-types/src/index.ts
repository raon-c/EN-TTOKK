// Health check response type
export interface HealthResponse {
  status: "ok" | "error";
  timestamp: string;
}

// Generic API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
