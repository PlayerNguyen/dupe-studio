import { Alert, Button, Flex, Group, Stack, Text } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { storageQueryKeys } from "../../services/storage/queryKeys";
import { updateInstance } from "../../services/storage/storageService";
import type { DatabaseInstance } from "../../types/storage";
import {
  availableDatabases,
  type CreateInstancePayload,
} from "../AddInstanceModal";
import { useModal } from "../useModal";

/** Id shared by the engine form and the footer save button. */
const FORM_ID = "edit-instance-form";

/** Props the modal is opened with (see `ModalPropsMap`). */
export interface EditInstanceModalProps {
  /** Saved row to edit; supplied by the sidebar's edit action. */
  instance: DatabaseInstance;
}

/**
 * Body of the edit-database-instance modal.
 *
 * Receives the row through the modal props (`useModal("editInstance").open`)
 * rather than a dedicated store, looks up its engine in the `availableDatabases`
 * registry and renders that engine's form prefilled from the row
 * (`toInitialValues`). Submitting calls `updateInstance`, invalidates the
 * instances query and closes the modal.
 *
 * Registered as `editInstance` in `src/modals/registry.ts`.
 *
 * @param props - The saved instance being edited.
 * @returns The prefilled engine form.
 */
export function EditInstanceModal({ instance }: EditInstanceModalProps) {
  const { t } = useTranslation();
  const { close } = useModal("editInstance");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: CreateInstancePayload) =>
      updateInstance(
        instance.id,
        payload.input,
        payload.password,
        payload.remember,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: storageQueryKeys.instances,
      });
      close();
    },
  });

  const error = mutation.isError
    ? mutation.error instanceof Error
      ? mutation.error.message
      : t("database.add.errors.createFailed")
    : null;

  const active = availableDatabases.find(
    (database) => database.kind === instance.kind,
  );

  if (!active) {
    return <Alert color="red">{t("errors.database.unsupportedEngine")}</Alert>;
  }

  return (
    <Flex direction="column" gap="md">
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
    </Flex>
  );
}
