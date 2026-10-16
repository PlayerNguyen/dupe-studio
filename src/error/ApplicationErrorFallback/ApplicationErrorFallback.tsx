import { Alert, Code, Stack, Text } from "@mantine/core";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRouteError } from "react-router";

/**
 * Route-level error boundary for the application router.
 *
 * Rendered by React Router whenever a route throws during render, load or
 * action. It surfaces a readable message instead of a blank screen. When the
 * thrown value is a known backend i18n key (see `src/i18n/errors.ts`) it is
 * translated; otherwise the raw message is shown for debugging.
 *
 * @returns An alert describing the caught error.
 */
export function ApplicationErrorFallback() {
  const { t, i18n } = useTranslation();
  const error = useRouteError();

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const message = raw && i18n.exists(raw) ? t(raw) : raw || t("errors.unknown");

  return (
    <Stack align="center" justify="center" h="100vh" p="xl">
      <Alert
        color="red"
        variant="light"
        icon={<TriangleAlert size={18} />}
        title={t("errors.title")}
        maw={560}
      >
        <Text size="sm" mb="xs">
          {t("errors.pageUnavailable")}
        </Text>
        <Code block>{message}</Code>
      </Alert>
    </Stack>
  );
}
