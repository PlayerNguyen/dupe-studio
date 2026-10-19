import { Group, Modal, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { FRONTEND_VERSION } from "../../config/appInfo";
import { getAppVersion } from "../../services/system/systemService";
import { useModal } from "../useModal";

/** Props for the private {@link VersionRow} helper. */
interface VersionRowProps {
  /** Localized label shown on the left. */
  label: string;
  /** Version value shown monospaced on the right. */
  value: string;
}

/** Renders one label/value version line. */
function VersionRow({ label, value }: VersionRowProps) {
  return (
    <Group justify="space-between" gap="xl">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text ff="monospace" size="sm">
        {value}
      </Text>
    </Group>
  );
}

/**
 * About modal.
 *
 * Defines its own Mantine `<Modal>` and reads `isOpen`/`close` from
 * `useModal("about")`. Shows the frontend bundle version (bundled at build
 * time) beside the backend crate version queried from the `app_version` Tauri
 * command. Both are synced to the released git tag by the release pipeline.
 * Registered as `about` in `src/modals/registry.ts`.
 *
 * @returns The about dialog with the version summary.
 */
export function AboutModal() {
  const { t } = useTranslation();
  const { isOpen, close } = useModal("about");
  const { data: backendVersion, isError } = useQuery({
    queryKey: ["app-version"],
    queryFn: getAppVersion,
    retry: false,
    enabled: isOpen,
  });

  const backendValue =
    backendVersion ?? (isError ? t("common.about.unavailable") : "…");

  return (
    <Modal
      opened={isOpen}
      onClose={close}
      title={t("common.about.title")}
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
    >
      <Stack gap="xs">
        <VersionRow
          label={t("common.about.frontendVersion")}
          value={FRONTEND_VERSION}
        />
        <VersionRow
          label={t("common.about.backendVersion")}
          value={backendValue}
        />
      </Stack>
    </Modal>
  );
}
