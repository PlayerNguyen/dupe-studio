import {
  ActionIcon,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { Database, Plus, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useModal } from "../../../../modals";
import { connectInstance } from "../../../../services/database/databaseService";
import { useInstances } from "../../../../services/storage/useInstances";

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
 * `errors.storage.secretMissing` until a password prompt exists. In the
 * collapsed rail the same data is rendered as icon buttons with tooltipped
 * names, matching the static navigation entries.
 *
 * @param props - Whether the sidebar is collapsed.
 * @returns The saved-instance list, its loading/empty/error states, the add
 *   action and the connect feedback.
 */
export function DatabaseInstanceList({ collapsed }: DatabaseInstanceListProps) {
  const { t } = useTranslation();
  const addInstance = useModal("addInstance");
  const { data, isLoading, isError } = useInstances();
  const instances = data?.items ?? [];

  const connectMutation = useMutation({
    mutationFn: (instanceId: string) => connectInstance(instanceId),
  });

  const connect = (instanceId: string) => connectMutation.mutate(instanceId);

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
          <UnstyledButton
            key={instance.id}
            onClick={() => connect(instance.id)}
            disabled={connectMutation.isPending}
            aria-label={instance.name}
            data-testid="database-instance"
            className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--mantine-color-default-hover)] disabled:opacity-60"
          >
            <Group gap="xs" wrap="nowrap">
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
            </Group>
          </UnstyledButton>
        ))}
      </Stack>

      {connectMutation.isError ? (
        <Text c="red" size="xs" px="xs">
          {connectMutation.error instanceof Error
            ? connectMutation.error.message
            : t("database.instances.connectFailed")}
        </Text>
      ) : null}
    </Stack>
  );
}
