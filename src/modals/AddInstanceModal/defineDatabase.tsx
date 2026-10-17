import type {
  AvailableDatabase,
  DatabaseInstanceDraft,
  DatabaseRegistration,
} from "./types";

/**
 * Registers an engine form while erasing its concrete draft type.
 *
 * The modal shell works with {@link AvailableDatabase} entries and must not
 * know whether an engine uses host/port, a file path, or another shape. This
 * helper keeps the engine's `initialValues`, `Form` and `toInput` bound to the
 * same draft type, then exposes a render function that already converts the
 * validated draft into a `NewDatabaseInstance` payload.
 *
 * The returned object is safe to use generically because the form and its
 * defaults never travel separately: `renderForm` closes over both.
 *
 * @typeParam TDraft - Engine-specific draft produced by the form.
 * @param registration - Engine metadata, defaults, form and payload mapper.
 * @returns The type-erased registry entry consumed by the modal.
 *
 * @example
 * ```tsx
 * const mysql = defineDatabase({
 *   kind: "mysql",
 *   initialValues: { instanceName: "", isFavorite: false, ... },
 *   Form: MySqlInstanceForm,
 *   toInput: (values) => ({ ...values, kind: "mysql" }),
 *   // ...
 * });
 * ```
 */
export function defineDatabase<TDraft extends DatabaseInstanceDraft>(
  registration: DatabaseRegistration<TDraft>,
): AvailableDatabase {
  return {
    kind: registration.kind,
    labelKey: registration.labelKey,
    descriptionKey: registration.descriptionKey,
    icon: registration.icon,
    initialValues: registration.initialValues,
    renderForm: ({ formId, isSubmitting, error, onSubmit }) => (
      <registration.Form
        formId={formId}
        initialValues={registration.initialValues}
        isSubmitting={isSubmitting}
        error={error}
        onSubmit={(values) =>
          onSubmit({
            input: registration.toInput(values),
            password: values.password.length > 0 ? values.password : null,
            remember: values.remember,
          })
        }
      />
    ),
  };
}
