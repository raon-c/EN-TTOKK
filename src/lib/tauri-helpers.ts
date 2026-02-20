import type { Result } from "@/bindings";

export async function unwrap<T>(
  promise: Promise<Result<T, string>>
): Promise<T> {
  const result = await promise;
  if (result.status === "error") throw new Error(result.error);
  return result.data;
}
