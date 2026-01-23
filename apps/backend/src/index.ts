import type { HealthResponse } from "@enttokk/api-types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "./lib/logger";
import chat from "./routes/chat";

const app = new Hono();

// CORS middleware for frontend communication
app.use(
  "*",
  cors({
    origin: ["http://localhost:1420", "tauri://localhost"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// Health check endpoint
app.get("/healthz", (c) => {
  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
  return c.json(response);
});

// Chat routes
app.route("/chat", chat);

// Get port from environment or use default
const port = Number(process.env.PORT) || 31337;

// Graceful shutdown handler
const server = Bun.serve({
  port,
  fetch: app.fetch,
  // Disable idle timeout for SSE streaming (0 = no timeout)
  idleTimeout: 0,
});

logger.info(`Backend server running on http://localhost:${port}`);

// Handle shutdown signals
process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down...");
  server.stop();
  process.exit(0);
});
