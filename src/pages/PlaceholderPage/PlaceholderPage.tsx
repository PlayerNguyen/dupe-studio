import { Stack, Text, ThemeIcon, Title } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Props for {@link PlaceholderPage}. */
export interface PlaceholderPageProps {
  /** i18n key for the page title, usually the sidebar entry's label key. */
  titleKey: string;
  /** i18n key for the one-line explanation of the upcoming page. */
  descriptionKey: string;
  /** Lucide icon shown above the title. Defaults to a construction glyph. */
  icon?: LucideIcon;
}

/**
 * Temporary content for routes whose real UI has not been built yet.
 *
 * Every sidebar destination is wired to a page immediately so navigation works
 * end to end; this component is the stand-in until each page is implemented.
 * Title and description are resolved from i18n keys so they stay localized.
 *
 * @param props - See {@link PlaceholderPageProps}.
 * @returns A centered empty state describing the upcoming page.
 */
export function PlaceholderPage({
  titleKey,
  descriptionKey,
  icon,
}: PlaceholderPageProps) {
  const { t } = useTranslation();
  const Icon = icon ?? Construction;

  return (
    <Stack align="center" justify="center" h="100%" p="xl" gap="md">
      <ThemeIcon size={64} radius="xl" variant="light" color="brand">
        <Icon />
      </ThemeIcon>
      <Title order={2}>{t(titleKey)}</Title>
      <Text c="dimmed" maw={440} ta="center">
        {t(descriptionKey)}
      </Text>
    </Stack>
  );
}
