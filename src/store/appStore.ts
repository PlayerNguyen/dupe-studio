import { create } from "zustand";

import {
  isSidebarCompacted,
  SIDEBAR_COMPACTED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from "../config/sidebarLayout";

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
   * rendered is derived from it (see `src/config/sidebarLayout.ts`).
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
 * @example
 * ```ts
 * const width = useAppStore((state) => state.sidebarWidth);
 * const toggle = useAppStore((state) => state.toggleSidebar);
 * ```
 */
export const useAppStore = create<AppState>((set) => ({
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
}));
