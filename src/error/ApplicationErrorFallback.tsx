import { Alert, Code, Stack, Text } from "@mantine/core";
import { TriangleAlert } from "lucide-react";
import { useRouteError } from "react-router";

/**
 * Route-level error boundary for the application router.
 *
 * Rendered by React Router whenever a route throws during render, load or
 * action. It surfaces a readable message instead of a blank screen.
 *
 * @returns An alert describing the caught error.
 */
export function ApplicationErrorFallback() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  return (
    <Stack align="center" justify="center" h="100vh" p="xl">
      <Alert
        color="red"
        variant="light"
        icon={<TriangleAlert size={18} />}
        title="Something went wrong"
        maw={560}
      >
        <Text size="sm" mb="xs">
          The page could not be displayed.
        </Text>
        <Code block>{message}</Code>
      </Alert>
    </Stack>
  );
}
