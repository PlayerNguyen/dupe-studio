import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { storageQueryKeys } from "../../services/storage/queryKeys";
import { updateInstance } from "../../services/storage/storageService";
import { useInstanceEditorStore } from "../../store/instanceEditorStore";
import {
  availableDatabases,
  type CreateInstancePayload,
} from "../AddInstanceModal";
import { useModal } from "../useModal";

/** Id shared by the engine form and the footer save button. */
const FORM_ID = "edit-instance-form";

/**
 * Body of the edit-database-instance modal.
 *
 * Reads the row from {@link useInstanceEditorStore}, looks up its engine in the
 * `availableDatabases` registry and renders that engine's form prefilled from
 * the row (`toInitialValues`). Submitting calls `updateInstance`, invalidates
 * the instances query and closes the modal; the edited row is cleared when the
 * body unmounts, so every close path resets the flow.
 *
 * Registered as `editInstance` in `src/modals/registry.ts`.
 *
 * @returns The prefilled engine form, or `null` while no row is selected.
 */
export function EditInstanceModal() {
  const { t } = useTranslation();
  const { close } = useModal("editInstance");
  const instance = useInstanceEditorStore((state) => state.instance);
  const clearInstance = useInstanceEditorStore((state) => state.close);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: CreateInstancePayload) => {
      if (!instance) {
        return Promise.reject(new Error(t("errors.unknown")));
      }

      return updateInstance(
        instance.id,
        payload.input,
        payload.password,
        payload.remember,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: storageQueryKeys.instances,
      });
      close();
    },
  });

  // Clear the edited row whenever the modal body unmounts.
  useEffect(() => () => clearInstance(), [clearInstance]);

  const error = mutation.isError
    ? mutation.error instanceof Error
      ? mutation.error.message
      : t("database.add.errors.createFailed")
    : null;

  if (!instance) {
    return null;
  }

  const active = availableDatabases.find(
    (database) => database.kind === instance.kind,
  );

  if (!active) {
    return <Alert color="red">{t("errors.database.unsupportedEngine")}</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Stack gap={2}>
        <Text fw={600}>{t(active.labelKey)}</Text>
        <Text size="xs" c="dimmed">
          {t(active.descriptionKey)}
        </Text>
      </Stack>

      {active.renderForm({
        formId: FORM_ID,
        isSubmitting: mutation.isPending,
        error,
        instance,
        onSubmit: (payload) => mutation.mutate(payload),
      })}

      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={close} disabled={mutation.isPending}>
          {t("database.add.actions.cancel")}
        </Button>
        <Button type="submit" form={FORM_ID} loading={mutation.isPending}>
          {t("database.edit.actions.save")}
        </Button>
      </Group>
    </div>
  );
}
