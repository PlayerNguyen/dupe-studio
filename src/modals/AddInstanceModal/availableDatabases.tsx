import { Database } from "lucide-react";

import type { DatabaseKind } from "../../types/database";
import { MySqlInstanceForm } from "./components/MySqlInstanceForm";
import { defineDatabase } from "./defineDatabase";
import type { AvailableDatabase, MySqlDatabaseDraft } from "./types";

/**
 * Default values for the MySQL form.
 *
 * Defaults belong to the engine registration, not to the modal shell: a future
 * SQLite entry would ship a file-path default and no port at all. Keeping them
 * here makes adding or changing an engine a one-file edit.
 */
const mysqlInitialValues: MySqlDatabaseDraft = {
  instanceName: "",
  password: "",
  remember: true,
  isFavorite: false,
  host: "127.0.0.1",
  port: 3306,
  databaseName: "",
  username: "root",
};

/**
 * Registry of every database engine the add-instance modal can create.
 *
 * This is the single place to add an engine:
 *
 * 1. Create a form component implementing
 *    `DatabaseInstanceFormProps<TYourDraft>`.
 * 2. Define the draft defaults and a `toInput` mapper for the columns that
 *    engine uses.
 * 3. Add a `defineDatabase({...})` entry below with its i18n label keys and
 *    icon.
 *
 * The left rail and the right pane both read this array, so no shell changes
 * are required. Only engines with an implemented backend strategy should be
 * listed; an unsupported engine would let users save a connection that cannot
 * be opened.
 */
export const availableDatabases: readonly AvailableDatabase[] = [
  defineDatabase({
    kind: "mysql",
    labelKey: "database.kinds.mysql.label",
    descriptionKey: "database.kinds.mysql.description",
    icon: Database,
    initialValues: mysqlInitialValues,
    Form: MySqlInstanceForm,
    toInput: (values) => ({
      name: values.instanceName.trim(),
      kind: "mysql",
      host: values.host.trim(),
      port: Number(values.port),
      database_name: values.databaseName.trim() || null,
      username: values.username.trim(),
      secret_ref: null,
      is_favorite: values.isFavorite,
    }),
  }),
];

/**
 * Looks up a registered engine by its persisted kind.
 *
 * @param kind - Engine id from the current selection or a saved row.
 * @returns The matching registration, or `undefined` when the app does not
 *   support that engine yet.
 */
export function findAvailableDatabase(
  kind: DatabaseKind,
): AvailableDatabase | undefined {
  return availableDatabases.find((database) => database.kind === kind);
}

/**
 * First registered engine, used as the modal's initial selection.
 *
 * @returns The first registry entry; the registry is intentionally non-empty.
 */
export function firstAvailableDatabase(): AvailableDatabase {
  return availableDatabases[0];
}
