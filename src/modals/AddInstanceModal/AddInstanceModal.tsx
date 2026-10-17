import { Button, Group, Stack, Text } from "@mantine/core";
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
 * Body of the add-database-instance modal.
 *
 * Renders a two-pane layout: the left rail lists every engine from
 * `availableDatabases`, and the right pane renders the selected engine's form.
 * The shell is engine-agnostic — it passes registry defaults and the create
 * mutation down through `renderForm`, and receives a ready
 * `NewDatabaseInstance` payload from the registration's `toInput`.
 *
 * On success the modal invalidates {@link storageQueryKeys.instances} and
 * closes; because `ModalHost` unmounts modal bodies when they close, the form
 * and selection reset on the next open. On failure the localized service error
 * is shown inside the form and the modal stays open.
 *
 * Registered as `addInstance` in `src/modals/registry.ts`.
 *
 * @returns The engine rail and the selected engine's form.
 */
export function AddInstanceModal() {
  const { t } = useTranslation();
  const { close } = useModal("addInstance");
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
    <div className="flex flex-col gap-4">
      <div className="flex min-h-[360px] gap-4">
        <div className="w-56 shrink-0 border-r border-[var(--mantine-color-default-border)] pr-3">
          <DatabaseKindList
            items={availableDatabases}
            activeKind={active.kind}
            disabled={mutation.isPending}
            onSelect={selectKind}
          />
        </div>

        <div className="min-w-0 flex-1">
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
        </div>
      </div>

      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={close} disabled={mutation.isPending}>
          {t("database.add.actions.cancel")}
        </Button>
        <Button type="submit" form={FORM_ID} loading={mutation.isPending}>
          {t("database.add.actions.create")}
        </Button>
      </Group>
    </div>
  );
}
