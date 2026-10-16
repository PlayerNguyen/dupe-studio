import { Stack, Text, ThemeIcon, Title } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

/** Props for {@link PlaceholderPage}. */
export interface PlaceholderPageProps {
  /** Page title, usually the matching sidebar entry's label. */
  title: string;
  /** One-line explanation of what the page will eventually do. */
  description: string;
  /** Lucide icon shown above the title. Defaults to a construction glyph. */
  icon?: LucideIcon;
}

/**
 * Temporary content for routes whose real UI has not been built yet.
 *
 * Every sidebar destination is wired to a page immediately so navigation works
 * end to end; this component is the stand-in until each page is implemented.
 *
 * @param props - See {@link PlaceholderPageProps}.
 * @returns A centered empty state describing the upcoming page.
 */
export function PlaceholderPage({
  title,
  description,
  icon,
}: PlaceholderPageProps) {
  const Icon = icon ?? Construction;

  return (
    <Stack align="center" justify="center" h="100%" p="xl" gap="md">
      <ThemeIcon size={64} radius="xl" variant="light" color="brand">
        <Icon size={30} />
      </ThemeIcon>
      <Title order={2}>{title}</Title>
      <Text c="dimmed" maw={440} ta="center">
        {description}
      </Text>
    </Stack>
  );
}
