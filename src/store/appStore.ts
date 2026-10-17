import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  isSidebarCompacted,
  SIDEBAR_COMPACTED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from "../config/sidebarLayout";

/**
 * `localStorage` key the store is persisted under.
 *
 * Exported so tests and tooling can read or seed the persisted snapshot instead
 * of hard-coding the key.
 */
export const APP_STORE_STORAGE_KEY = "dupe-studio.app-store";

/**
 * Global, synchronous client state for the app.
 *
 * Only state that is truly cross-cutting and synchronous belongs here; anything
 * asynchronous (Tauri commands, HTTP) goes through TanStack Query instead. This
 * keeps the store small and free of Redux-style reducers, slices and middleware.
 */
export interface AppState {
  /**
   * Width of the primary sidebar in pixels.
   *
   * The sidebar is resizable (`Splitter` in `src/layouts/AppLayout`), so the
   * width is the single source of truth: whether the compacted icon rail is
   * rendered is derived from it (see `src/config/sidebarLayout.ts`). This is a
   * user preference, so it is restored on the next launch.
   */
  sidebarWidth: number;
  /** Number of times the demo greeting has been requested. */
  greetCount: number;
  /** Sets the sidebar width in pixels. */
  setSidebarWidth: (width: number) => void;
  /** Flips the sidebar between the expanded width and the compacted rail. */
  toggleSidebar: () => void;
  /** Records that another greeting was requested. */
  incrementGreetCount: () => void;
  /** Resets the store to its initial values (used by tests). */
  reset: () => void;
}

const initialState = {
  sidebarWidth: SIDEBAR_EXPANDED_WIDTH,
  greetCount: 0,
} as const;

/**
 * The application Zustand store.
 *
 * Persisted to `localStorage` under {@link APP_STORE_STORAGE_KEY} through
 * Zustand's `persist` middleware. Only the sidebar width is stored: it is the
 * one user preference here, and a restored width means the sidebar comes back
 * the way the user left it. `greetCount` is demo state and is deliberately not
 * persisted, so it starts at zero on every launch.
 *
 * @example
 * ```ts
 * const width = useAppStore((state) => state.sidebarWidth);
 * const toggle = useAppStore((state) => state.toggleSidebar);
 * ```
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      toggleSidebar: () =>
        set((state) => ({
          sidebarWidth: isSidebarCompacted(state.sidebarWidth)
            ? SIDEBAR_EXPANDED_WIDTH
            : SIDEBAR_COMPACTED_WIDTH,
        })),
      incrementGreetCount: () =>
        set((state) => ({ greetCount: state.greetCount + 1 })),
      reset: () => set(initialState),
    }),
    {
      name: APP_STORE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sidebarWidth: state.sidebarWidth }),
    },
  ),
);
