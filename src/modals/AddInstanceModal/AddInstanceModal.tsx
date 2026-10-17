import {
  Box,
  Button,
  Flex,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { storageQueryKeys } from "../../services/storage/queryKeys";
import { createInstance } from "../../services/storage/storageService";
import type { DatabaseKind } from "../../types/database";
import { useModal } from "../useModal";
import {
  availableDatabases,
  findAvailableDatabase,
  firstAvailableDatabase,
} from "./availableDatabases";
import { DatabaseKindList } from "./components/DatabaseKindList";
import type { CreateInstancePayload } from "./types";

/** Id shared by the engine form and the footer's submit button. */
const FORM_ID = "add-instance-form";

/**
 * Add-database-instance modal.
 *
 * Defines its own Mantine `<Modal>` and reads `isOpen`/`close` from
 * `useModal("addInstance")`. The body has a two-pane layout: the left rail
 * lists every engine from `availableDatabases`, and the right pane renders the
 * selected engine's form. Each pane has its own `ScrollArea` and the footer sits
 * outside them, so overflow never scrolls (and therefore never shifts) the whole
 * modal.
 *
 * The shell is engine-agnostic — it passes registry defaults and the create
 * mutation down through `renderForm`, and receives a ready
 * `CreateInstancePayload` from the registration's `toInput` and credential
 * fields.
 *
 * On success the modal invalidates {@link storageQueryKeys.instances} and
 * closes; because `ModalHost` unmounts modal bodies when they close, the form
 * and selection reset on the next open. On failure the localized service error
 * is shown inside the form and the modal stays open.
 *
 * Registered as `addInstance` in `src/modals/registry.ts`.
 *
 * @returns The add-instance dialog.
 */
export function AddInstanceModal() {
  const { t } = useTranslation();
  const { isOpen, close } = useModal("addInstance");
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<DatabaseKind>(
    () => firstAvailableDatabase().kind,
  );

  const active = findAvailableDatabase(kind) ?? firstAvailableDatabase();

  const mutation = useMutation({
    mutationFn: (payload: CreateInstancePayload) =>
      createInstance(payload.input, payload.password, payload.remember),
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

  const selectKind = (nextKind: DatabaseKind) => {
    mutation.reset();
    setKind(nextKind);
  };

  return (
    <Modal.Root opened={isOpen} onClose={close} size={860} centered>
      <Modal.Overlay backgroundOpacity={0.55} blur={3} />
      <Modal.Content className="flex flex-col overflow-y-hidden">
        <Modal.Header>
          <Modal.Title>{t("database.add.title")}</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>

        <Modal.Body className="flex-1 min-h-0 overflow-hidden">
          <Flex gap="md" h={"100vh"}>
            <Box
              w={224}
              className="shrink-0 border-r border-(--mantine-color-default-border) pr-3"
            >
              <ScrollArea h="100vh" type="hover">
                <DatabaseKindList
                  items={availableDatabases}
                  activeKind={active.kind}
                  disabled={mutation.isPending}
                  onSelect={selectKind}
                />
              </ScrollArea>
            </Box>

            <ScrollArea flex={1} miw={0} h="100vh" type="hover">
              <Box pr="sm">
                <Stack gap={2} mb="md">
                  <Text fw={600}>{t(active.labelKey)}</Text>
                  <Text size="xs" c="dimmed">
                    {t(active.descriptionKey)}
                  </Text>
                </Stack>

                {active.renderForm({
                  formId: FORM_ID,
                  isSubmitting: mutation.isPending,
                  error,
                  onSubmit: (payload) => mutation.mutate(payload),
                })}
              </Box>
            </ScrollArea>
          </Flex>
        </Modal.Body>

        <Group
          justify="flex-end"
          gap="sm"
          p="md"
          className="border-t border-(--mantine-color-default-border)"
        >
          <Button
            variant="default"
            onClick={close}
            disabled={mutation.isPending}
          >
            {t("database.add.actions.cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} loading={mutation.isPending}>
            {t("database.add.actions.create")}
          </Button>
        </Group>
      </Modal.Content>
    </Modal.Root>
  );
}
