import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { greet } from "../../services/system/systemService";
import { useAppStore } from "../../store/appStore";

/**
 * Landing page of the application.
 *
 * Demonstrates the full frontend stack: Mantine components, Tailwind utilities
 * bound to the brand palette, a dark/light color-scheme toggle, a TanStack
 * Query mutation calling a Tauri command through `src/services`, and small
 * synchronous state through the Zustand store.
 *
 * @returns The rendered home page.
 */
export function HomePage() {
  const [name, setName] = useState("");
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const greetCount = useAppStore((state) => state.greetCount);
  const incrementGreetCount = useAppStore((state) => state.incrementGreetCount);

  const greetMutation = useMutation({
    mutationFn: greet,
    onSuccess: () => incrementGreetCount(),
  });

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1} className="text-brand">
            dupe-studio
          </Title>
          <Button
            variant="light"
            aria-label="Toggle color scheme"
            leftSection={colorScheme === "dark" ? <Sun /> : <Moon />}
            onClick={toggleColorScheme}
          >
            {colorScheme === "dark" ? "Light" : "Dark"}
          </Button>
        </Group>

        <Text c="dimmed">
          Frontend foundation: React 19, Vite, Mantine, Tailwind, TanStack Query
          and Zustand.
        </Text>

        <Card
          withBorder
          radius="md"
          padding="lg"
          className="border-brand-200 shadow-sm"
        >
          <Stack gap="sm">
            <Badge color="brand" variant="light" w="fit-content">
              Brand #114573
            </Badge>

            <Text size="sm">
              Greetings requested so far:{" "}
              <Text span fw={700} data-testid="greet-count">
                {greetCount}
              </Text>
            </Text>

            <TextInput
              label="Name"
              placeholder="Enter a name..."
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />

            <Group>
              <Button
                loading={greetMutation.isPending}
                disabled={name.trim().length === 0}
                onClick={() => greetMutation.mutate({ name })}
              >
                Greet
              </Button>
              {greetMutation.data ? (
                <Text data-testid="greet-result">{greetMutation.data}</Text>
              ) : null}
              {greetMutation.isError ? (
                <Text c="red">{String(greetMutation.error)}</Text>
              ) : null}
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
