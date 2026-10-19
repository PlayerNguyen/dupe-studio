/**
 * TanStack Query keys for the application-owned storage domain.
 *
 * Read hooks must build their keys from these factories so mutations can
 * invalidate a whole domain with one prefix. The add-instance modal invalidates
 * {@link storageQueryKeys.instances} after a successful insert, which refreshes
 * every saved-instance list regardless of its page or sort.
 *
 * @example
 * ```ts
 * useQuery({
 *   queryKey: storageQueryKeys.instances,
 *   queryFn: () => listInstances(),
 * });
 * ```
 */
export const storageQueryKeys = {
  /** Prefix for every saved-instance query. */
  instances: ["storage", "instances"] as const,
} as const;
