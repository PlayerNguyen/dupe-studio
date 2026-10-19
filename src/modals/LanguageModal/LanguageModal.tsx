import { Modal, Stack, Text, ThemeIcon, UnstyledButton } from "@mantine/core";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { type SupportedLanguage, supportedLanguages } from "../../i18n";
import { cn } from "../../utils/cn";
import { useModal } from "../useModal";

/**
 * Language picker modal.
 *
 * Defines its own Mantine `<Modal>` and reads `isOpen`/`close` from
 * `useModal("language")`. Lists every supported language; selecting one
 * switches the active i18next language (cached by the detector) and closes the
 * modal. Registered as `language` in `src/modals/registry.ts`.
 *
 * @returns The language picker dialog.
 */
export function LanguageModal() {
  const { t, i18n } = useTranslation();
  const { isOpen, close } = useModal("language");

  const selectLanguage = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language);
    close();
  };

  return (
    <Modal
      opened={isOpen}
      onClose={close}
      title={t("common.language.title")}
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
    >
      <Stack gap="xs">
        {supportedLanguages.map((language) => {
          const active = i18n.resolvedLanguage === language;

          return (
            <UnstyledButton
              key={language}
              aria-pressed={active}
              mod={{ active }}
              onClick={() => selectLanguage(language)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors",
                "border-[var(--mantine-color-default-border)] hover:bg-[var(--mantine-color-default-hover)]",
                "data-[active=true]:border-brand data-[active=true]:bg-[var(--mantine-color-brand-light)]",
              )}
            >
              <Text fw={500}>{t(`common.language.options.${language}`)}</Text>
              {active ? (
                <ThemeIcon size="sm" radius="xl" variant="light" color="brand">
                  <Check />
                </ThemeIcon>
              ) : null}
            </UnstyledButton>
          );
        })}
      </Stack>
    </Modal>
  );
}
