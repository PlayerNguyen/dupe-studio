import { ActionIcon, Stack, Tooltip, UnstyledButton } from "@mantine/core";
import { Database, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { DatabaseInstance } from "../../../../../types/storage";

/** Props for {@link CollapsedInstanceList}. */
export interface CollapsedInstanceListProps {
  /** Saved instances to render as icon buttons. */
  instances: readonly DatabaseInstance[];
  /** Disables selection while a connect request is in flight. */
  connecting: boolean;
  /** Opens the add-instance modal. */
  onAdd: () => void;
  /** Connects to the instance with the given id. */
  onConnect: (instanceId: string) => void;
}

/**
 * Collapsed icon-rail rendering of the saved-instance list.
 *
 * Used by `DatabaseInstanceList` when the sidebar is compacted: the add action
 * and every instance become icon buttons with tooltipped labels, matching the
 * static navigation entries. Row actions (edit/delete) are intentionally not
 * offered in this form.
 *
 * @param props - Instances, the connect handler and the request state.
 * @returns The icon rail for the instances section.
 */
export function CollapsedInstanceList({
  instances,
  connecting,
  onAdd,
  onConnect,
}: CollapsedInstanceListProps) {
  const { t } = useTranslation();

  return (
    <Stack gap={4} align="center" data-testid="database-instance-list">
      <div className="mx-auto h-px w-6 bg-[var(--mantine-color-default-border)]" />
      <Tooltip label={t("database.instances.add")} position="right" withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("database.instances.add")}
          onClick={onAdd}
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
            disabled={connecting}
            onClick={() => onConnect(instance.id)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--mantine-color-dimmed)] transition-colors hover:bg-[var(--mantine-color-default-hover)] hover:text-[var(--mantine-color-text)]"
          >
            <Database size={20} />
          </UnstyledButton>
        </Tooltip>
      ))}
    </Stack>
  );
}
