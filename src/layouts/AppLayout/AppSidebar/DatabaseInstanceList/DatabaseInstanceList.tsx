import {
  ActionIcon,
  Box,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { Database, Plus, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useModal } from "../../../../modals";
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
 * action that opens the add-instance modal, which keeps creation reachable
 * from any page.
 *
 * In the collapsed rail the same data is rendered as icon buttons with
 * tooltipped names, matching the static navigation entries.
 *
 * @param props - Whether the sidebar is collapsed.
 * @returns The saved-instance list, its loading/empty/error states and the
 *   add action.
 */
export function DatabaseInstanceList({ collapsed }: DatabaseInstanceListProps) {
  const { t } = useTranslation();
  const addInstance = useModal("addInstance");
  const { data, isLoading, isError } = useInstances();
  const instances = data?.items ?? [];

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
            <Box
              aria-label={instance.name}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--mantine-color-dimmed)]"
            >
              <Database size={20} />
            </Box>
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
            gap="xs"
            wrap="nowrap"
            px="xs"
            py={6}
            className="rounded-lg"
            data-testid="database-instance"
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
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
