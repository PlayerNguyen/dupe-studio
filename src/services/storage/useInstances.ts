import { useQuery } from "@tanstack/react-query";

import { storageQueryKeys } from "./queryKeys";
import { listInstances } from "./storageService";

/**
 * Page size requested by the sidebar list.
 *
 * The list is meant to show every saved instance at a glance, so it asks for
 * the backend's maximum page size. If a workspace ever exceeds it, the sidebar
 * should switch to the cursor pagination the service already supports.
 */
const SIDEBAR_LIMIT = 200;

/**
 * Loads every saved database instance for the sidebar.
 *
 * Thin TanStack Query wrapper over {@link listInstances}: it reuses
 * {@link storageQueryKeys.instances}, the same prefix the add-instance modal
 * invalidates after a successful insert, so the sidebar refreshes as soon as a
 * new instance is created.
 *
 * @returns The query result; `data?.items` holds the saved instances.
 *
 * @example
 * ```tsx
 * const { data, isLoading, isError } = useInstances();
 * const instances = data?.items ?? [];
 * ```
 */
export function useInstances() {
  return useQuery({
    queryKey: storageQueryKeys.instances,
    queryFn: () => listInstances({ limit: SIDEBAR_LIMIT }),
  });
}
