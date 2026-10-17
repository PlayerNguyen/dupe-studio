import { ActionIcon, Menu } from "@mantine/core";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { DatabaseInstance } from "../../../../../types/storage";

/** Props for {@link InstanceActionsMenu}. */
export interface InstanceActionsMenuProps {
  /** Saved instance the actions apply to. */
  instance: DatabaseInstance;
  /** Opens the edit modal for the instance. */
  onEdit: (instance: DatabaseInstance) => void;
  /** Deletes the instance with the given id. */
  onDelete: (instanceId: string) => void;
}

/**
 * Hover-revealed `…` menu with the row actions for a saved instance.
 *
 * The trigger starts transparent and becomes visible on hover, on keyboard
 * focus, and while the menu is open; that relies on the row carrying the
 * Tailwind `group` class. The items are compact by request: explicit
 * `paddingBlock`/`paddingInline` and an `itemSection` gap, because Tailwind's
 * preflight resets the margin Mantine would otherwise give the icon.
 *
 * @param props - The instance and the edit/delete handlers.
 * @returns The ellipsis trigger and its edit/delete dropdown.
 */
export function InstanceActionsMenu({
  instance,
  onEdit,
  onDelete,
}: InstanceActionsMenuProps) {
  const { t } = useTranslation();

  return (
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
          onClick={() => onEdit(instance)}
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
          onClick={() => onDelete(instance.id)}
        >
          {t("database.instances.delete")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
