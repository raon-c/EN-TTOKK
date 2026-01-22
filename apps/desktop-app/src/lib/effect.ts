import { Data, Effect } from "effect";

import type { Result } from "@/bindings";

// Error types
export class VaultError extends Data.TaggedError("VaultError")<{
  readonly message: string;
}> {}

export class NoVaultError extends Data.TaggedError("NoVaultError")<{
  readonly message: string;
}> {}

export type AppError = VaultError | NoVaultError;

// Helper: Convert Result to Effect
export function fromResult<T>(
  result: Result<T, string>
): Effect.Effect<T, VaultError> {
  if (result.status === "error") {
    return Effect.fail(new VaultError({ message: result.error }));
  }

  return Effect.succeed(result.data);
}

// Helper: Wrap command call as Effect
export function runCommand<T>(
  command: () => Promise<Result<T, string>>
): Effect.Effect<T, VaultError> {
  return Effect.tryPromise({
    try: command,
    catch: (e) => new VaultError({ message: String(e) }),
  }).pipe(Effect.flatMap(fromResult));
}

export const runEffect = <T>({
  effect,
  onError,
}: {
  effect: Effect.Effect<T, AppError>;
  onError: (message: string) => void;
}) =>
  Effect.runPromise(
    effect.pipe(
      Effect.catchAll((error) =>
        Effect.flatMap(
          Effect.sync(() => onError(error.message)),
          () => Effect.fail(error)
        )
      )
    )
  );
