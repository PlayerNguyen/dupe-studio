import type { ComponentType } from "react";

import { AboutModal } from "./AboutModal";
import { LanguageModal } from "./LanguageModal";

/** Definition of a single registrable global modal. */
export interface ModalDefinition {
  /** i18n key for the modal title (see `src/i18n/locales`). */
  titleKey: string;
  /** Component rendered inside the modal body. Mounted only while open. */
  Component: ComponentType;
}

/**
 * Registry of every global modal in the application.
 *
 * Add an entry to make a modal openable through `useModal` and rendered by
 * `ModalHost`; the key becomes a valid {@link ModalId}. The registry maps ids to
 * already-defined components, so the host can render only the open ones.
 *
 * @example
 * ```ts
 * modalRegistry.language.titleKey; // "common.language.title"
 * ```
 */
export const modalRegistry = {
  language: {
    titleKey: "common.language.title",
    Component: LanguageModal,
  },
  about: {
    titleKey: "common.about.title",
    Component: AboutModal,
  },
} as const satisfies Record<string, ModalDefinition>;

/** Union of every registered modal id. */
export type ModalId = keyof typeof modalRegistry;
