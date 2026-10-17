import {
  ActionIcon,
  Group,
  Menu,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Ellipsis, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useModal } from "../../../../modals";
import { connectInstance } from "../../../../services/database/databaseService";
import { storageQueryKeys } from "../../../../services/storage/queryKeys";
import { deleteInstance } from "../../../../services/storage/storageService";
import { useInstances } from "../../../../services/storage/useInstances";
import { useInstanceEditorStore } from "../../../../store/instanceEditorStore";
import type { DatabaseInstance } from "../../../../types/storage";

/** Props for {@link DatabaseInstanceList}. */
export interface DatabaseInstanceListProps {
  /** Whether the sidebar is in its collapsed icon-rail form. */
  collapsed: boolean;
}

/**
 * Sidebar section listing every saved database instance.
 *
 * Reads the shared {@link useInstances} query, so it stays in sync with the
 * add-instance modal: the modal invalidates the instances key after a
 * successful insert and this list refetches. The section header carries the
 * action that opens the add-instance modal, which keeps creation reachable from
 * any page.
 *
 * Selecting an instance calls `connectInstance`, which resolves the password
 * from the OS credential store in the backend; a session-only instance surfaces
 * `errors.storage.secretMissing` until a password prompt exists. Each row also
 * exposes a hover-revealed menu: "Edit" opens the `editInstance` modal with the
 * row, and "Delete" removes the instance and its stored credential.
 *
 * In the collapsed rail the same data is rendered as icon buttons with
 * tooltipped names; the row actions are only offered in the expanded form.
 *
 * @param props - Whether the sidebar is collapsed.
 * @returns The saved-instance list, its states, the add action and row actions.
 */
export function DatabaseInstanceList({ collapsed }: DatabaseInstanceListProps) {
  const { t } = useTranslation();
  const addInstance = useModal("addInstance");
  const editInstanceModal = useModal("editInstance");
  const openEditor = useInstanceEditorStore((state) => state.open);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useInstances();
  const instances = data?.items ?? [];

  const connectMutation = useMutation({
    mutationFn: (instanceId: string) => connectInstance(instanceId),
  });

  const deleteMutation = useMutation({
    mutationFn: (instanceId: string) => deleteInstance(instanceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: storageQueryKeys.instances,
      });
    },
  });

  const connect = (instanceId: string) => connectMutation.mutate(instanceId);

  const edit = (instance: DatabaseInstance) => {
    openEditor(instance);
    editInstanceModal.open();
  };

  const remove = (instanceId: string) => deleteMutation.mutate(instanceId);

  if (collapsed) {
    return (
      <Stack gap={4} align="center" data-testid="database-instance-list">
        <div className="mx-auto h-px w-6 bg-[var(--mantine-color-default-border)]" />
        <Tooltip label={t("database.instances.add")} position="right" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={t("database.instances.add")}
            onClick={addInstance.open}
          >
            <Plus size={18} />
          </ActionIcon>
        </Tooltip>
        {instances.map((instance) => (
          <Tooltip
            key={instance.id}
            label={instance.name}
            position="right"
            withArrow
            offset={8}
          >
            <UnstyledButton
              aria-label={instance.name}
              disabled={connectMutation.isPending}
              onClick={() => connect(instance.id)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--mantine-color-dimmed)] transition-colors hover:bg-[var(--mantine-color-default-hover)] hover:text-[var(--mantine-color-text)]"
            >
              <Database size={20} />
            </UnstyledButton>
          </Tooltip>
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={4} data-testid="database-instance-list">
      <Group justify="space-between" px="xs" wrap="nowrap">
        <Text
          c="dimmed"
          fw={600}
          size="xs"
          tt="uppercase"
          className="tracking-wide"
        >
          {t("database.instances.title")}
        </Text>
        <Tooltip label={t("database.instances.add")} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={t("database.instances.add")}
            onClick={addInstance.open}
          >
            <Plus size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {isLoading ? (
        <Text c="dimmed" size="xs" px="xs">
          {t("database.instances.loading")}
        </Text>
      ) : null}
      {isError ? (
        <Text c="red" size="xs" px="xs">
          {t("database.instances.error")}
        </Text>
      ) : null}
      {!isLoading && !isError && instances.length === 0 ? (
        <Text c="dimmed" size="xs" px="xs">
          {t("database.instances.empty")}
        </Text>
      ) : null}

      <Stack gap={2}>
        {instances.map((instance) => (
          <Group
            key={instance.id}
            gap={0}
            wrap="nowrap"
            px="xs"
            py={4}
            className="group rounded-lg transition-colors hover:bg-[var(--mantine-color-default-hover)]"
            data-testid="database-instance"
          >
            <UnstyledButton
              onClick={() => connect(instance.id)}
              disabled={connectMutation.isPending}
              aria-label={instance.name}
              className="flex min-w-0 flex-1 items-center gap-xs text-left"
            >
              <ThemeIcon size="sm" radius="md" variant="light" color="brand">
                <Database size={14} />
              </ThemeIcon>
              <div className="min-w-0 flex-1">
                <Text size="sm" truncate>
                  {instance.name}
                </Text>
                <Text c="dimmed" size="xs" truncate>
                  {t(`database.kinds.${instance.kind}.label`, {
                    defaultValue: instance.kind,
                  })}
                </Text>
              </div>
              {instance.is_favorite ? (
                <Star
                  size={14}
                  className="shrink-0 text-brand"
                  fill="currentColor"
                />
              ) : null}
            </UnstyledButton>

            <Menu
              position="bottom-end"
              withinPortal
              shadow="md"
              width={150}
              styles={{ dropdown: { padding: 4 } }}
            >
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={t("database.instances.actions")}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                >
                  <Ellipsis size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<Pencil size={14} />}
                  styles={{
                    item: { paddingBlock: 4, paddingInline: 8 },
                    itemSection: { marginInlineEnd: 8 },
                  }}
                  onClick={() => edit(instance)}
                >
                  {t("database.instances.edit")}
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<Trash2 size={14} />}
                  styles={{
                    item: { paddingBlock: 4, paddingInline: 8 },
                    itemSection: { marginInlineEnd: 8 },
                  }}
                  onClick={() => remove(instance.id)}
                >
                  {t("database.instances.delete")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        ))}
      </Stack>

      {connectMutation.isError ? (
        <Text c="red" size="xs" px="xs">
          {connectMutation.error instanceof Error
            ? connectMutation.error.message
            : t("database.instances.connectFailed")}
        </Text>
      ) : null}
      {deleteMutation.isError ? (
        <Text c="red" size="xs" px="xs">
          {deleteMutation.error instanceof Error
            ? deleteMutation.error.message
            : t("database.instances.deleteFailed")}
        </Text>
      ) : null}
    </Stack>
  );
}
