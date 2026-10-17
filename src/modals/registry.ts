import type { ComponentType } from "react";

import type { DatabaseInstance } from "../types/storage";
import { AboutModal } from "./AboutModal";
import { AddInstanceModal } from "./AddInstanceModal";
import { EditInstanceModal } from "./EditInstanceModal";
import { LanguageModal } from "./LanguageModal";

/**
 * Props every registrable modal is opened with.
 *
 * Adding an entry here makes `useModal` type-check the props passed to `open`
 * and gives the IDE autocomplete for the payload. Use `undefined` for modals
 * that take no props.
 */
export interface ModalPropsMap {
  language: undefined;
  about: undefined;
  addInstance: undefined;
  editInstance: { instance: DatabaseInstance };
}

/** Union of every registered modal id. */
export type ModalId = keyof ModalPropsMap;

/** Props a modal id is opened with. */
export type ModalPropsFor<TId extends ModalId> = ModalPropsMap[TId];

/**
 * Registry of every global modal in the application.
 *
 * Each component **defines its own Mantine `<Modal>`** and reads its open state,
 * close handler and typed props through `useModal`; `ModalHost` only mounts the
 * components. That keeps per-modal concerns (title, size, styles, layout) next
 * to the modal body instead of in a shared host.
 *
 * To add a modal: add its props to {@link ModalPropsMap} and register the
 * component here.
 *
 * @example
 * ```ts
 * const edit = useModal("editInstance");
 * edit.open({ instance });
 * ```
 */
export const modalRegistry: Record<ModalId, ComponentType> = {
  language: LanguageModal,
  about: AboutModal,
  addInstance: AddInstanceModal,
  editInstance: EditInstanceModal,
};
