import {
  Box,
  Flex,
  Group,
  Text,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { Database, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { DatabaseInstance } from "../../../../../types/storage";
import { InstanceActionsMenu } from "../InstanceActionsMenu";

/** Props for {@link InstanceRow}. */
export interface InstanceRowProps {
  /** Saved instance rendered by this row. */
  instance: DatabaseInstance;
  /** Disables the connect action while a request is in flight. */
  connecting: boolean;
  /** Connects to the instance. */
  onConnect: (instanceId: string) => void;
  /** Opens the edit modal for the instance. */
  onEdit: (instance: DatabaseInstance) => void;
  /** Deletes the instance. */
  onDelete: (instanceId: string) => void;
}

/**
 * One saved-instance row in the expanded sidebar list.
 *
 * The name area connects on click; the hover-revealed actions menu is a sibling
 * of that button (not nested) so the markup stays valid. The row carries the
 * Tailwind `group` class the menu uses to reveal itself.
 *
 * @param props - The instance and the connect/edit/delete handlers.
 * @returns The clickable instance row with its actions menu.
 */
export function InstanceRow({
  instance,
  connecting,
  onConnect,
  onEdit,
  onDelete,
}: InstanceRowProps) {
  const { t } = useTranslation();

  return (
    <Group
      gap={0}
      wrap="nowrap"
      px="xs"
      py={4}
      className="group rounded-lg transition-colors hover:bg-[var(--mantine-color-default-hover)]"
      data-testid="database-instance"
    >
      <Flex
        component={UnstyledButton}
        onClick={connecting ? undefined : () => onConnect(instance.id)}
        aria-disabled={connecting || undefined}
        aria-label={instance.name}
        align="center"
        gap="xs"
        flex={1}
        miw={0}
        className="text-left"
      >
        <ThemeIcon size="sm" radius="md" variant="light" color="brand">
          <Database />
        </ThemeIcon>
        <Box flex={1} miw={0}>
          <Text size="sm" truncate>
            {instance.name}
          </Text>
          <Text c="dimmed" size="xs" truncate>
            {t(`database.kinds.${instance.kind}.label`, {
              defaultValue: instance.kind,
            })}
          </Text>
        </Box>
        {instance.is_favorite ? (
          <Star className="shrink-0 text-brand" fill="currentColor" />
        ) : null}
      </Flex>

      <InstanceActionsMenu
        instance={instance}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </Group>
  );
}
