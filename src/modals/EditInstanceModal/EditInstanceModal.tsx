import { Alert, Button, Flex, Group, Modal, Stack, Text } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { storageQueryKeys } from "../../services/storage/queryKeys";
import { updateInstance } from "../../services/storage/storageService";
import {
  availableDatabases,
  type CreateInstancePayload,
} from "../AddInstanceModal";
import { useModal } from "../useModal";

/** Id shared by the engine form and the footer save button. */
const FORM_ID = "edit-instance-form";

/**
 * Edit-database-instance modal.
 *
 * Defines its own Mantine `<Modal>` and reads `isOpen`/`close` plus the typed
 * `{ instance }` payload from `useModal("editInstance")`. Looks up the row's
 * engine in the `availableDatabases` registry and renders that engine's form
 * prefilled from the row (`toInitialValues`). Submitting calls `updateInstance`,
 * invalidates the instances query and closes the modal.
 *
 * Registered as `editInstance` in `src/modals/registry.ts`.
 *
 * @returns The edit-instance dialog.
 */
export function EditInstanceModal() {
  const { t } = useTranslation();
  const { isOpen, props, close } = useModal("editInstance");
  const instance = props?.instance;
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

  const error = mutation.isError
    ? mutation.error instanceof Error
      ? mutation.error.message
      : t("database.add.errors.createFailed")
    : null;

  const active = instance
    ? availableDatabases.find((database) => database.kind === instance.kind)
    : undefined;

  return (
    <Modal
      opened={isOpen}
      onClose={close}
      title={t("database.edit.title")}
      size={860}
      styles={{ content: { overflowY: "hidden" } }}
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
    >
      {!instance ? null : !active ? (
        <Alert color="red">{t("errors.database.unsupportedEngine")}</Alert>
      ) : (
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
            <Button
              variant="default"
              onClick={close}
              disabled={mutation.isPending}
            >
              {t("database.add.actions.cancel")}
            </Button>
            <Button type="submit" form={FORM_ID} loading={mutation.isPending}>
              {t("database.edit.actions.save")}
            </Button>
          </Group>
        </Flex>
      )}
    </Modal>
  );
}
