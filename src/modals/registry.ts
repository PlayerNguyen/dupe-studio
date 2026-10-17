import type { ModalProps } from "@mantine/core";
import type { ComponentType } from "react";

import { AboutModal } from "./AboutModal";
import { AddInstanceModal } from "./AddInstanceModal";
import { LanguageModal } from "./LanguageModal";

/** Definition of a single registrable global modal. */
export interface ModalDefinition {
  /** i18n key for the modal title (see `src/i18n/locales`). */
  titleKey: string;
  /** Component rendered inside the modal body. Mounted only while open. */
  Component: ComponentType;
  /**
   * Optional Mantine modal size. Defaults to Mantine's `md` when omitted; wide
   * modals with a rail plus content (such as the add-instance modal) set a
   * pixel value here.
   */
  size?: ModalProps["size"];
}

/** Source-of-truth modal definitions, checked against {@link ModalDefinition}. */
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
} as const satisfies Record<string, ModalDefinition>;

/**
 * Registry of every global modal in the application.
 *
 * Add an entry to `definitions` to make a modal openable through `useModal`
 * and rendered by `ModalHost`; the key becomes a valid {@link ModalId}. The
 * registry maps ids to already-defined components, so the host can render only
 * the open ones.
 *
 * Values are widened to {@link ModalDefinition} so optional properties such as
 * `size` are uniformly readable, while the keys stay literal for
 * {@link ModalId}.
 *
 * @example
 * ```ts
 * modalRegistry.language.titleKey; // "common.language.title"
 * ```
 */
export const modalRegistry: {
  [K in keyof typeof definitions]: ModalDefinition;
} = definitions;

/** Union of every registered modal id. */
export type ModalId = keyof typeof modalRegistry;
