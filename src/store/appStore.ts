import { create } from "zustand";

/**
 * Global, synchronous client state for the app.
 *
 * Only state that is truly cross-cutting and synchronous belongs here; anything
 * asynchronous (Tauri commands, HTTP) goes through TanStack Query instead. This
 * keeps the store small and free of Redux-style reducers, slices and middleware.
 */
export interface AppState {
  /** Whether the primary sidebar is collapsed. */
  sidebarCollapsed: boolean;
  /** Number of times the demo greeting has been requested. */
  greetCount: number;
  /** Sets the sidebar collapsed flag to an explicit value. */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Flips the sidebar collapsed flag. */
  toggleSidebar: () => void;
  /** Records that another greeting was requested. */
  incrementGreetCount: () => void;
  /** Resets the store to its initial values (used by tests). */
  reset: () => void;
}

const initialState = {
  sidebarCollapsed: false,
  greetCount: 0,
} as const;

/**
 * The application Zustand store.
 *
 * @example
 * ```ts
 * const count = useAppStore((state) => state.greetCount);
 * const increment = useAppStore((state) => state.incrementGreetCount);
 * ```
 */
export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  incrementGreetCount: () =>
    set((state) => ({ greetCount: state.greetCount + 1 })),
  reset: () => set(initialState),
}));
