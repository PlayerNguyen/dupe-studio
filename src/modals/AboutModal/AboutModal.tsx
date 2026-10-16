import { Group, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { FRONTEND_VERSION } from "../../config/appInfo";
import { getAppVersion } from "../../services/system/systemService";

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
 * Body of the about modal.
 *
 * Shows the frontend bundle version (bundled at build time) beside the backend
 * crate version queried from the `app_version` Tauri command. Both are synced to
 * the released git tag by the release pipeline. Registered as `about` in
 * `src/modals/registry.ts`.
 *
 * @returns The version summary.
 */
export function AboutModal() {
  const { t } = useTranslation();
  const { data: backendVersion, isError } = useQuery({
    queryKey: ["app-version"],
    queryFn: getAppVersion,
    retry: false,
  });

  const backendValue =
    backendVersion ?? (isError ? t("common.about.unavailable") : "…");

  return (
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
  );
}
