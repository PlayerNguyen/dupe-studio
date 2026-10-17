import { useModalStore } from "../store/modalStore";
import type { ModalId, ModalPropsFor } from "./registry";

/**
 * Open/toggle signature for a modal's props.
 *
 * Modals registered with `undefined` props are callable with no arguments;
 * every other modal requires its payload, which keeps `open` type-safe and
 * gives the IDE the prop shape as a suggestion.
 */
type OpenFn<TProps> = undefined extends TProps
  ? (props?: TProps) => void
  : (props: TProps) => void;

/** Value returned by {@link useModal}. */
export interface UseModalResult<TProps> {
  /** Whether the modal is currently open. */
  isOpen: boolean;
  /** Props the modal was opened with, if any. */
  props: TProps | undefined;
  /** Opens the modal with its typed props. */
  open: OpenFn<TProps>;
  /** Closes the modal and clears its props. */
  close: () => void;
  /** Toggles the modal open state. */
  toggle: OpenFn<TProps>;
}

/**
 * Binds a registered modal id to open/close helpers.
 *
 * Thin, typed wrapper over `useModalStore` so call sites never touch raw ids or
 * the underlying store shape. The props type comes from `ModalPropsMap`, so
 * `open` accepts exactly what the modal component expects. The modal component
 * itself is rendered by `ModalHost` when `isOpen` becomes `true`.
 *
 * @param id - A key from `modalRegistry` (`src/modals/registry.ts`).
 * @returns The modal's open state, its props and controls.
 *
 * @example
 * ```tsx
 * const edit = useModal("editInstance");
 * return <Button onClick={() => edit.open({ instance })}>Edit</Button>;
 * ```
 */
export function useModal<TId extends ModalId>(
  id: TId,
): UseModalResult<ModalPropsFor<TId>> {
  const isOpen = useModalStore((state) => Boolean(state.openModals[id]));
  const props = useModalStore((state) => state.modalProps[id]) as
    | ModalPropsFor<TId>
    | undefined;
  const openModal = useModalStore((state) => state.openModal);
  const closeModal = useModalStore((state) => state.closeModal);
  const toggleModal = useModalStore((state) => state.toggleModal);

  return {
    isOpen,
    props,
    open: ((value?: ModalPropsFor<TId>) => openModal(id, value)) as OpenFn<
      ModalPropsFor<TId>
    >,
    close: () => closeModal(id),
    toggle: ((value?: ModalPropsFor<TId>) => toggleModal(id, value)) as OpenFn<
      ModalPropsFor<TId>
    >,
  };
}
