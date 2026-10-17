import { create } from "zustand";

/**
 * Global, synchronous state for which modals are open and the props they were
 * opened with.
 *
 * The store is intentionally decoupled from the modal registry: it tracks
 * boolean flags keyed by modal id plus an optional props payload, so any
 * feature can open a modal without importing its component. Use {@link useModal}
 * from `src/modals` for a typed, per-modal view of this store.
 */
export interface ModalState {
  /** Map of modal id to whether it is currently open. */
  openModals: Record<string, boolean>;
  /** Props each open modal was opened with, keyed by modal id. */
  modalProps: Record<string, unknown>;
  /** Opens the modal registered under `id`, replacing its props. */
  openModal: (id: string, props?: unknown) => void;
  /** Closes the modal registered under `id` and clears its props. */
  closeModal: (id: string) => void;
  /** Flips the open state of the modal registered under `id`. */
  toggleModal: (id: string, props?: unknown) => void;
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
  modalProps: {},
  openModal: (id, props) =>
    set((state) => ({
      openModals: { ...state.openModals, [id]: true },
      modalProps:
        props === undefined
          ? state.modalProps
          : { ...state.modalProps, [id]: props },
    })),
  closeModal: (id) =>
    set((state) => {
      const modalProps = { ...state.modalProps };
      delete modalProps[id];

      return {
        openModals: { ...state.openModals, [id]: false },
        modalProps,
      };
    }),
  toggleModal: (id, props) =>
    set((state) => {
      const open = !state.openModals[id];

      return {
        openModals: { ...state.openModals, [id]: open },
        modalProps:
          open && props !== undefined
            ? { ...state.modalProps, [id]: props }
            : state.modalProps,
      };
    }),
  closeAll: () => set({ openModals: {}, modalProps: {} }),
  reset: () => set({ openModals: {}, modalProps: {} }),
}));
