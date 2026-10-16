import { useModalStore } from "../store/modalStore";
import type { ModalId } from "./registry";

/** Value returned by {@link useModal}. */
export interface UseModalResult {
  /** Whether the modal is currently open. */
  isOpen: boolean;
  /** Opens the modal. */
  open: () => void;
  /** Closes the modal. */
  close: () => void;
  /** Toggles the modal open state. */
  toggle: () => void;
}

/**
 * Binds a registered modal id to open/close helpers.
 *
 * Thin, typed wrapper over `useModalStore` so call sites never touch raw ids or
 * the underlying store shape. The modal component itself is rendered by
 * `ModalHost` when `isOpen` becomes `true`.
 *
 * @param id - A key from `modalRegistry` (`src/modals/registry.tsx`).
 * @returns The modal's open state and controls.
 *
 * @example
 * ```tsx
 * const { open } = useModal("language");
 * return <Button onClick={open}>Language</Button>;
 * ```
 */
export function useModal(id: ModalId): UseModalResult {
  const isOpen = useModalStore((state) => Boolean(state.openModals[id]));
  const openModal = useModalStore((state) => state.openModal);
  const closeModal = useModalStore((state) => state.closeModal);
  const toggleModal = useModalStore((state) => state.toggleModal);

  return {
    isOpen,
    open: () => openModal(id),
    close: () => closeModal(id),
    toggle: () => toggleModal(id),
  };
}
