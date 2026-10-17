import { create } from "zustand";

import type { DatabaseInstance } from "../types/storage";

/**
 * Small synchronous state for the edit-instance flow.
 *
 * The modal store only tracks whether a modal is open, so the row being edited
 * lives here: the sidebar writes it before opening the `editInstance` modal and
 * the modal clears it when its body unmounts (any close path).
 */
export interface InstanceEditorState {
  /** Saved instance currently being edited, or `null`. */
  instance: DatabaseInstance | null;
  /** Stores the row to edit. */
  open: (instance: DatabaseInstance) => void;
  /** Clears the edited row. */
  close: () => void;
  /** Clears all editor state (used by tests). */
  reset: () => void;
}

/**
 * The application instance-editor store.
 *
 * @example
 * ```ts
 * const openEditor = useInstanceEditorStore((state) => state.open);
 * openEditor(instance);
 * ```
 */
export const useInstanceEditorStore = create<InstanceEditorState>((set) => ({
  instance: null,
  open: (instance) => set({ instance }),
  close: () => set({ instance: null }),
  reset: () => set({ instance: null }),
}));
