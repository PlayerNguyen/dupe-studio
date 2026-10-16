import { QueryClient } from "@tanstack/react-query";

/**
 * Creates a fresh TanStack Query client for the application.
 *
 * A factory (instead of a module-level singleton) is used so tests and the
 * running app each get an isolated cache. Server and Tauri state is owned by
 * this client; small synchronous client state lives in `src/store`.
 *
 * @returns A configured {@link QueryClient}.
 *
 * @example
 * ```ts
 * const queryClient = createQueryClient();
 * ```
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
