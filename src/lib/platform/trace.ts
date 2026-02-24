const TRACE_PREFIX = "ent";

export const createTraceId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().split("-")[0];
  return `${TRACE_PREFIX}-${timestamp}-${random}`;
};
