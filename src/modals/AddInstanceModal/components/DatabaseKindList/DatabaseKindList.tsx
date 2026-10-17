import { NavLink, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { DatabaseKind } from "../../../../types/database";
import type { AvailableDatabase } from "../../types";

/** Props for {@link DatabaseKindList}. */
export interface DatabaseKindListProps {
  /** Registry entries available to the user, in display order. */
  items: readonly AvailableDatabase[];
  /** Engine currently rendered in the right pane. */
  activeKind: DatabaseKind;
  /** Disables selection while a create request is in flight. */
  disabled?: boolean;
  /** Called with the engine id the user picked. */
  onSelect: (kind: DatabaseKind) => void;
}

/**
 * Left rail of the add-instance modal.
 *
 * Mirrors the visual language of `AppSidebar` (icon, label, description and a
 * brand-tinted active state) without depending on the router or app store.
 * The list is driven entirely by the {@link AvailableDatabase} registry, so a
 * new engine appears here as soon as its registry entry is added.
 *
 * @param props - Registry entries, the active engine and the selection handler.
 * @returns A scrollable list of engines.
 */
export function DatabaseKindList({
  items,
  activeKind,
  disabled = false,
  onSelect,
}: DatabaseKindListProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xs">
      <Text
        c="dimmed"
        fw={600}
        size="xs"
        tt="uppercase"
        px="xs"
        className="tracking-wide"
      >
        {t("database.add.availableDatabases")}
      </Text>

      <Stack gap={4}>
        {items.map(({ kind, labelKey, descriptionKey, icon: Icon }) => (
          <NavLink
            key={kind}
            active={kind === activeKind}
            label={t(labelKey)}
            description={t(descriptionKey)}
            leftSection={<Icon />}
            onClick={() => onSelect(kind)}
            disabled={disabled}
            color="brand"
            variant="light"
            className="rounded-xl"
          />
        ))}
      </Stack>
    </Stack>
  );
}
