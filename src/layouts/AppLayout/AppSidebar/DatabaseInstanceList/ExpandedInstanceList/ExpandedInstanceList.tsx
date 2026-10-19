import { ActionIcon, Group, Stack, Text, Tooltip } from "@mantine/core";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { DatabaseInstance } from "../../../../../types/storage";
import { InstanceRow } from "../InstanceRow";

/** Props for {@link ExpandedInstanceList}. */
export interface ExpandedInstanceListProps {
  /** Saved instances to render, in display order. */
  instances: readonly DatabaseInstance[];
  /** Whether the instances query is loading. */
  isLoading: boolean;
  /** Whether the instances query failed. */
  isError: boolean;
  /** Disables connect while a request is in flight. */
  connecting: boolean;
  /** Opens the add-instance modal. */
  onAdd: () => void;
  /** Connects to the instance with the given id. */
  onConnect: (instanceId: string) => void;
  /** Opens the edit modal for the instance. */
  onEdit: (instance: DatabaseInstance) => void;
  /** Deletes the instance with the given id. */
  onDelete: (instanceId: string) => void;
  /** Localized connect error, or `null`. */
  connectError: string | null;
  /** Localized delete error, or `null`. */
  deleteError: string | null;
}

/**
 * Expanded rendering of the saved-instance list.
 *
 * Renders the section header with the add action, the loading/empty/error
 * states, one {@link InstanceRow} per instance and the last connect/delete
 * error. Pure presentation: the mutations and callbacks live in
 * `DatabaseInstanceList`, which keeps this component easy to test and read.
 *
 * @param props - Instances, query state, callbacks and error messages.
 * @returns The expanded instances section.
 */
export function ExpandedInstanceList({
  instances,
  isLoading,
  isError,
  connecting,
  onAdd,
  onConnect,
  onEdit,
  onDelete,
  connectError,
  deleteError,
}: ExpandedInstanceListProps) {
  const { t } = useTranslation();

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
            onClick={onAdd}
          >
            <Plus />
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
          <InstanceRow
            key={instance.id}
            instance={instance}
            connecting={connecting}
            onConnect={onConnect}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </Stack>

      {connectError ? (
        <Text c="red" size="xs" px="xs">
          {connectError}
        </Text>
      ) : null}
      {deleteError ? (
        <Text c="red" size="xs" px="xs">
          {deleteError}
        </Text>
      ) : null}
    </Stack>
  );
}
