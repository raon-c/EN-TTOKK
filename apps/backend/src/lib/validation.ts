import { z } from "zod";

/**
 * Validates that a path does not contain directory traversal sequences
 */
const safePathString = z
  .string()
  .refine((path) => !path.includes(".."), {
    message: "Path cannot contain directory traversal sequences",
  })
  .refine((path) => !path.includes("\0"), {
    message: "Path cannot contain null bytes",
  });

/**
 * Schema for chat request validation
 */
export const chatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(100000, "Message too long"),
  workingDirectory: safePathString.optional(),
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  systemPrompt: z.string().max(10000).optional(),
});

/**
 * Schema for cancel request validation
 */
export const cancelRequestSchema = z.object({
  requestId: z.string().uuid("Invalid request ID format"),
});

export type ValidatedChatRequest = z.infer<typeof chatRequestSchema>;
export type ValidatedCancelRequest = z.infer<typeof cancelRequestSchema>;

/**
 * Schema for Google OAuth token exchange/refresh
 */
export const googleTokenRequestSchema = z
  .object({
    grantType: z.enum(["authorization_code", "refresh_token"]),
    code: z.string().optional(),
    codeVerifier: z.string().optional(),
    refreshToken: z.string().optional(),
    redirectUri: z.string().url("Invalid redirect URI"),
    clientId: z.string().min(1, "Client ID is required"),
    clientSecret: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.grantType === "authorization_code") {
      if (!data.code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Authorization code is required",
          path: ["code"],
        });
      }
      if (!data.codeVerifier) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Code verifier is required",
          path: ["codeVerifier"],
        });
      }
    }
    if (data.grantType === "refresh_token" && !data.refreshToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Refresh token is required",
        path: ["refreshToken"],
      });
    }
  });

/**
 * Schema for Google Calendar events list proxy
 */
export const googleEventsRequestSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  calendarId: z.string().optional(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  syncToken: z.string().optional(),
  pageToken: z.string().optional(),
  maxResults: z.number().int().min(1).max(250).optional(),
});

export type ValidatedGoogleTokenRequest = z.infer<
  typeof googleTokenRequestSchema
>;
export type ValidatedGoogleEventsRequest = z.infer<
  typeof googleEventsRequestSchema
>;

/**
 * Schema for Jira API token test
 */
const jiraBaseUrlSchema = z
  .string()
  .url("Invalid Jira base URL")
  .refine((value) => value.startsWith("https://"), {
    message: "Jira base URL must start with https://",
  })
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        const hostname = url.hostname;
        const validHost = hostname.endsWith(".atlassian.net");
        const pathOk = url.pathname === "" || url.pathname === "/";
        return (
          validHost &&
          pathOk &&
          !url.username &&
          !url.password &&
          !url.port &&
          !url.search &&
          !url.hash
        );
      } catch {
        return false;
      }
    },
    {
      message:
        "Jira base URL must be a Jira Cloud site (e.g. https://your-domain.atlassian.net)",
    }
  );

export const jiraTestRequestSchema = z.object({
  baseUrl: jiraBaseUrlSchema,
  email: z.string().email("Invalid email address"),
  apiToken: z.string().min(1, "API token is required"),
});

export const jiraIssuesRequestSchema = jiraTestRequestSchema;

export type ValidatedJiraTestRequest = z.infer<typeof jiraTestRequestSchema>;
export type ValidatedJiraIssuesRequest = z.infer<
  typeof jiraIssuesRequestSchema
>;
