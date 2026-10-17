import {
  Alert,
  Button,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation } from "@tanstack/react-query";
import { PlugZap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { testConnection } from "../../../../services/database/databaseService";
import type {
  DatabaseInstanceFormProps,
  MySqlDatabaseDraft,
} from "../../types";

/**
 * MySQL connection form rendered in the right pane of the add-instance modal.
 *
 * Collects the display name and the connection metadata stored in
 * `database_instances` (`host`, `port`, `database_name`, `username`). Defaults
 * come from the registry entry in `availableDatabases.tsx`, so a new engine can
 * change its defaults without touching this component. Password entry is
 * intentionally absent until the OS keychain integration lands; `secret_ref`
 * stays `null`.
 *
 * The form is uncontrolled with respect to the modal shell: it owns a Mantine
 * `useForm` instance, validates on submit, and calls `onSubmit` only with a
 * valid draft. The footer submit button lives in the shell and targets
 * {@link DatabaseInstanceFormProps.formId}.
 *
 * @param props - Registry defaults, submit handler and request state.
 * @returns The MySQL fields, inline validation errors and backend error alert.
 */
export function MySqlInstanceForm({
  formId,
  initialValues,
  onSubmit,
  isSubmitting,
  error,
}: DatabaseInstanceFormProps<MySqlDatabaseDraft>) {
  const { t } = useTranslation();
  const testMutation = useMutation({ mutationFn: testConnection });
  const form = useForm<MySqlDatabaseDraft>({
    initialValues,
    onValuesChange: () => testMutation.reset(),
    validate: {
      instanceName: (value) =>
        value.trim() ? null : t("database.add.errors.nameRequired"),
      host: (value) =>
        value.trim() ? null : t("database.add.errors.hostRequired"),
      port: (value) => {
        const port = Number(value);
        return Number.isInteger(port) && port >= 1 && port <= 65535
          ? null
          : t("database.add.errors.portInvalid");
      },
      username: (value) =>
        value.trim() ? null : t("database.add.errors.usernameRequired"),
    },
  });

  const handleTestConnection = () => {
    const connectionFields = ["host", "port", "username"] as const;
    if (!connectionFields.every((field) => form.isValid(field))) {
      return;
    }

    testMutation.mutate({
      kind: "mysql",
      host: form.values.host.trim(),
      port: Number(form.values.port),
      username: form.values.username.trim(),
      password: "",
      database: form.values.databaseName.trim() || null,
    });
  };

  return (
    <form
      id={formId}
      onSubmit={form.onSubmit(onSubmit)}
      className="flex flex-col gap-4"
      data-testid="mysql-instance-form"
    >
      {error ? (
        <Alert
          color="red"
          variant="light"
          title={t("database.add.errors.title")}
        >
          {error}
        </Alert>
      ) : null}

      <TextInput
        label={t("database.add.fields.instanceName")}
        placeholder={t("database.add.fields.instanceNamePlaceholder")}
        withAsterisk
        disabled={isSubmitting}
        {...form.getInputProps("instanceName")}
      />

      <Group grow align="flex-start">
        <TextInput
          label={t("database.add.fields.host")}
          placeholder={t("database.add.fields.hostPlaceholder")}
          withAsterisk
          disabled={isSubmitting}
          {...form.getInputProps("host")}
        />
        <NumberInput
          label={t("database.add.fields.port")}
          min={1}
          max={65535}
          allowDecimal={false}
          withAsterisk
          disabled={isSubmitting}
          {...form.getInputProps("port")}
        />
      </Group>

      <TextInput
        label={t("database.add.fields.databaseName")}
        placeholder={t("database.add.fields.databaseNamePlaceholder")}
        disabled={isSubmitting}
        {...form.getInputProps("databaseName")}
      />

      <TextInput
        label={t("database.add.fields.username")}
        withAsterisk
        disabled={isSubmitting}
        {...form.getInputProps("username")}
      />

      <Group gap="sm">
        <Button
          type="button"
          variant="light"
          leftSection={<PlugZap size={16} />}
          loading={testMutation.isPending}
          disabled={isSubmitting}
          onClick={handleTestConnection}
        >
          {t("database.add.actions.test")}
        </Button>
        {testMutation.isSuccess ? (
          <Text c="green" size="sm">
            {t("database.add.test.success")}
          </Text>
        ) : null}
        {testMutation.isError ? (
          <Text c="red" size="sm">
            {testMutation.error instanceof Error
              ? testMutation.error.message
              : t("database.add.test.failed")}
          </Text>
        ) : null}
      </Group>

      <Stack gap={2}>
        <Switch
          label={t("database.add.fields.favorite")}
          disabled={isSubmitting}
          {...form.getInputProps("isFavorite", { type: "checkbox" })}
        />
        <span className="text-xs text-[var(--mantine-color-dimmed)]">
          {t("database.add.fields.favoriteDescription")}
        </span>
      </Stack>
    </form>
  );
}
