import type { LucideIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import type { DatabaseKind } from "../../types/database";
import type { NewDatabaseInstance } from "../../types/storage";

/**
 * Fields every engine form must produce.
 *
 * Engine-specific drafts extend this interface, so the modal shell can rely on
 * `instanceName` and `isFavorite` without knowing which engine is selected.
 * SQLite, for example, can add a file-path field instead of `host`/`port`
 * without changing this base contract.
 */
export interface DatabaseInstanceDraft {
  /** User-visible name of the saved instance. Required by every engine. */
  instanceName: string;
  /** Whether the user pinned the instance to the top of the list. */
  isFavorite: boolean;
}

/**
 * Draft produced by the MySQL form.
 *
 * Extends the shared contract with the connection fields stored in
 * `database_instances`: host, port, default schema and login user. The form
 * validates these before handing the draft to {@link DatabaseRegistration}.
 */
export interface MySqlDatabaseDraft extends DatabaseInstanceDraft {
  /** Host name or IP address. */
  host: string;
  /** TCP port, kept as a string while the user edits the number input. */
  port: number | string;
  /** Optional default database/schema name. */
  databaseName: string;
  /** Login user. */
  username: string;
}

/**
 * Props every engine form receives.
 *
 * The form owns its `useForm` state and validation; the modal shell only
 * supplies the registry defaults, a submit callback, and the request status.
 *
 * @typeParam TDraft - Engine-specific draft produced by the form.
 */
export interface DatabaseInstanceFormProps<
  TDraft extends DatabaseInstanceDraft = DatabaseInstanceDraft,
> {
  /** Id set on the rendered `<form>`, used by the modal footer submit button. */
  formId: string;
  /**
   * Default values declared in the engine registration.
   *
   * Each engine decides its own shape (MySQL fills host/port, a future SQLite
   * form would fill a file path), so defaults live next to the registry entry
   * instead of in the modal shell.
   */
  initialValues: TDraft;
  /** Receives the validated draft when the user submits the form. */
  onSubmit: (values: TDraft) => void;
  /** Disables inputs and the submit action while a create request is running. */
  isSubmitting: boolean;
  /** Localized backend error to render above the fields, or `null`. */
  error: string | null;
}

/** Props used by {@link AvailableDatabase.renderForm}. */
export interface DatabaseFormRenderProps {
  /** Id shared by the engine form and the modal footer submit button. */
  formId: string;
  /** Whether a create request is currently in flight. */
  isSubmitting: boolean;
  /** Localized backend error to show inside the form. */
  error: string | null;
  /** Receives a ready-to-persist payload from the engine registration. */
  onSubmit: (input: NewDatabaseInstance) => void;
}

/**
 * One selectable engine in the add-instance modal.
 *
 * The registry erases each engine's concrete draft type at this boundary: the
 * form and its defaults stay paired inside {@link defineDatabase}, while the
 * modal shell only sees the engine metadata, a render function and the input
 * produced by that engine.
 */
export interface AvailableDatabase {
  /** Stable engine id persisted in `database_instances.kind`. */
  kind: DatabaseKind;
  /** i18n key for the engine name shown in the left rail. */
  labelKey: string;
  /** i18n key for the one-line description shown in the left rail. */
  descriptionKey: string;
  /** Lucide icon rendered as the rail entry's leading glyph. */
  icon: LucideIcon;
  /** Registry defaults for this engine (exposed for tests and diagnostics). */
  initialValues: DatabaseInstanceDraft;
  /** Renders this engine's form with its defaults and payload mapping. */
  renderForm: (props: DatabaseFormRenderProps) => ReactNode;
}

/**
 * Full definition of an engine before its draft type is erased.
 *
 * Register a new engine with {@link defineDatabase}; the helper keeps
 * `initialValues`, `Form` and `toInput` type-checked against the same draft.
 *
 * @typeParam TDraft - Engine-specific draft produced by the form.
 */
export interface DatabaseRegistration<
  TDraft extends DatabaseInstanceDraft = DatabaseInstanceDraft,
> {
  /** Stable engine id persisted in `database_instances.kind`. */
  kind: DatabaseKind;
  /** i18n key for the engine name. */
  labelKey: string;
  /** i18n key for the engine description. */
  descriptionKey: string;
  /** Icon shown in the engine rail. */
  icon: LucideIcon;
  /** Default values passed to the form. */
  initialValues: TDraft;
  /** Form component for this engine. */
  Form: ComponentType<DatabaseInstanceFormProps<TDraft>>;
  /**
   * Maps the validated draft to the persistence payload.
   *
   * Each engine decides which columns it uses (MySQL fills host/port, SQLite
   * would leave them `null` and use another field), so the shell never needs
   * engine-specific mapping logic.
   */
  toInput: (values: TDraft) => NewDatabaseInstance;
}
