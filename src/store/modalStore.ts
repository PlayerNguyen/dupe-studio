import { create } from "zustand";

/**
 * Global, synchronous state for which modals are open.
 *
 * The store is intentionally decoupled from the modal registry: it only tracks
 * boolean flags keyed by modal id, so any feature can open a modal without
 * importing its component. Use {@link useModal} from `src/modals` for a typed,
 * per-modal view of this store.
 */
export interface ModalState {
  /** Map of modal id to whether it is currently open. */
  openModals: Record<string, boolean>;
  /** Opens the modal registered under `id`. */
  openModal: (id: string) => void;
  /** Closes the modal registered under `id`. */
  closeModal: (id: string) => void;
  /** Flips the open state of the modal registered under `id`. */
  toggleModal: (id: string) => void;
  /** Closes every open modal. */
  closeAll: () => void;
  /** Clears all modal state (used by tests). */
  reset: () => void;
}

/**
 * The application modal store.
 *
 * @example
 * ```ts
 * const openModal = useModalStore((state) => state.openModal);
 * openModal("language");
 * ```
 */
export const useModalStore = create<ModalState>((set) => ({
  openModals: {},
  openModal: (id) =>
    set((state) => ({ openModals: { ...state.openModals, [id]: true } })),
  closeModal: (id) =>
    set((state) => ({ openModals: { ...state.openModals, [id]: false } })),
  toggleModal: (id) =>
    set((state) => ({
      openModals: { ...state.openModals, [id]: !state.openModals[id] },
    })),
  closeAll: () => set({ openModals: {} }),
  reset: () => set({ openModals: {} }),
}));
