import type { ModalProps } from "@mantine/core";
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
 * and gives the IDE autocomplete for the payload, so no per-modal store is
 * needed to transfer data into a popup. Use `undefined` for modals that take no
 * props.
 */
export interface ModalPropsMap {
  language: undefined;
  about: undefined;
  addInstance: undefined;
  editInstance: { instance: DatabaseInstance };
}

/** Definition of a single registrable global modal. */
export interface ModalDefinition<TProps = unknown> {
  /** i18n key for the modal title (see `src/i18n/locales`). */
  titleKey: string;
  /** Component rendered inside the modal body. Mounted only while open. */
  Component: ComponentType<TProps>;
  /**
   * Optional Mantine modal size. Defaults to Mantine's `md` when omitted; wide
   * modals with a rail plus content (such as the add-instance modal) set a
   * pixel value here.
   */
  size?: ModalProps["size"];
}

/** Registry shape: one definition per id, typed with that modal's props. */
export type ModalRegistry = {
  [K in keyof ModalPropsMap]: ModalDefinition<ModalPropsMap[K]>;
};

/** Source-of-truth modal definitions, checked against {@link ModalRegistry}. */
const definitions = {
  language: {
    titleKey: "common.language.title",
    Component: LanguageModal,
  },
  about: {
    titleKey: "common.about.title",
    Component: AboutModal,
  },
  addInstance: {
    titleKey: "database.add.title",
    Component: AddInstanceModal,
    size: 860,
  },
  editInstance: {
    titleKey: "database.edit.title",
    Component: EditInstanceModal,
    size: 860,
  },
} satisfies ModalRegistry;

/**
 * Registry of every global modal in the application.
 *
 * Add an entry to `definitions` and a matching `ModalPropsMap` entry to make a
 * modal openable through `useModal` and rendered by `ModalHost`; the key
 * becomes a valid {@link ModalId}. The host passes each modal's props through
 * to its component, so data (for example the instance being edited) travels as
 * a typed `open(id, props)` argument instead of a separate store.
 *
 * @example
 * ```ts
 * const edit = useModal("editInstance");
 * edit.open({ instance });
 * ```
 */
export const modalRegistry: ModalRegistry = definitions;

/** Union of every registered modal id. */
export type ModalId = keyof typeof modalRegistry;

/** Props a modal id is opened with. */
export type ModalPropsFor<TId extends ModalId> = ModalPropsMap[TId];
