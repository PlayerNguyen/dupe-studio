import {
  ActionIcon,
  Box,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from "@mantine/core";
import {
  Cog,
  Info,
  Languages,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { FRONTEND_VERSION } from "../../../config/appInfo";
import {
  isSidebarItemActive,
  type SidebarNavItem,
  sidebarBrand,
  sidebarConfig,
} from "../../../config/configureSidebar";
import { isSidebarCompacted } from "../../../config/sidebarLayout";
import { useModal } from "../../../modals";
import { useAppStore } from "../../../store/appStore";
import { POPOVER_TRANSITION_DURATION, smoothTransition } from "../../../theme";
import { IconProvider } from "../../../theme/IconProvider";
import { cn } from "../../../utils/cn";
import { DatabaseInstanceList } from "./DatabaseInstanceList";

/** Icon size in pixels used throughout the sidebar, instead of the global default. */
const SIDEBAR_ICON_SIZE = 16;

/** Renders the brand logo mark shown at the top of the sidebar. */
function BrandMark() {
  const Icon = sidebarBrand.icon;

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
      <Icon />
    </span>
  );
}

/**
 * Footer cog menu grouping the app-wide preferences.
 *
 * Exposes the color-scheme toggle and opens the language modal, keeping the
 * two global preferences behind a single control instead of separate buttons.
 * The dropdown sits in the sidebar footer, so it opens upwards and slides up
 * into place rather than using the pop animation the theme gives menus.
 */
function SettingsMenu() {
  const { t, i18n } = useTranslation();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const language = useModal("language");
  const about = useModal("about");

  return (
    <Menu
      position="top"
      withinPortal
      shadow="md"
      width={220}
      transitionProps={smoothTransition({
        transition: "slide-up",
        duration: POPOVER_TRANSITION_DURATION,
      })}
    >
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("common.settings.open")}
        >
          <Cog />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={colorScheme === "dark" ? <Sun /> : <Moon />}
          rightSection={
            <Text size="xs" c="dimmed">
              {t(`common.colorScheme.${colorScheme}`)}
            </Text>
          }
          onClick={toggleColorScheme}
        >
          {t("common.colorScheme.label")}
        </Menu.Item>
        <Menu.Item
          leftSection={<Languages />}
          rightSection={
            <Text size="xs" c="dimmed">
              {t(`common.language.options.${i18n.resolvedLanguage ?? "en"}`)}
            </Text>
          }
          onClick={() => language.open()}
        >
          {t("common.language.label")}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<Info />} onClick={() => about.open()}>
          {t("common.about.label")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** Props for {@link SidebarEntry}. */
interface SidebarEntryProps {
  /** The navigation entry to render. */
  item: SidebarNavItem;
  /** Whether the sidebar is in its compacted icon-rail form. */
  compacted: boolean;
  /** Whether the entry represents the current location. */
  active: boolean;
}

/**
 * Renders a single sidebar destination in either the expanded or compacted
 * form.
 *
 * Navigation is performed imperatively with `useNavigate` because this is a
 * desktop shell, so anchor semantics (open in new tab) are not required.
 */
function SidebarEntry({ item, compacted, active }: SidebarEntryProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const Icon = item.icon;
  const label = t(item.labelKey);
  const handleSelect = () => navigate(item.path);

  if (compacted) {
    return (
      <Tooltip label={label} position="right" withArrow offset={8}>
        <UnstyledButton
          aria-label={label}
          aria-current={active ? "page" : undefined}
          mod={{ active }}
          onClick={handleSelect}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl text-[var(--mantine-color-dimmed)] transition-colors",
            "hover:bg-[var(--mantine-color-default-hover)] hover:text-[var(--mantine-color-text)]",
            "data-[active=true]:bg-[var(--mantine-color-brand-light)] data-[active=true]:text-[var(--mantine-color-brand-light-color)]",
          )}
        >
          <Icon />
        </UnstyledButton>
      </Tooltip>
    );
  }

  return (
    <NavLink
      active={active}
      label={label}
      leftSection={<Icon />}
      onClick={handleSelect}
      color="brand"
      variant="light"
      className="rounded-xl"
    />
  );
}

/**
 * Primary application sidebar.
 *
 * Renders the brand header, the navigation model from
 * `src/config/configureSidebar.tsx`, the saved-instance list
 * (`DatabaseInstanceList`) and a footer settings menu (color scheme +
 * language). The sidebar fills the splitter pane that sizes it
 * (`src/layouts/AppLayout/AppLayout.tsx`), so the width comes from the store and
 * the compacted icon rail is derived from it: drag the pane to its minimum (or
 * click the toggle) and the labels are replaced by the rail.
 *
 * @returns The rendered sidebar navigation rail.
 */
export function AppSidebar() {
  const { t } = useTranslation();
  const sidebarWidth = useAppStore((state) => state.sidebarWidth);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const compacted = isSidebarCompacted(sidebarWidth);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Box
      component="nav"
      aria-label="Primary navigation"
      className="flex h-full w-full flex-col"
    >
      <IconProvider size={SIDEBAR_ICON_SIZE}>
        {compacted ? (
          <div className="flex flex-col items-center gap-2 px-3 py-3">
            <button
              type="button"
              aria-label={sidebarBrand.name}
              onClick={() => navigate("/")}
              className="cursor-pointer border-0 bg-transparent p-0"
            >
              <BrandMark />
            </button>
            <Tooltip
              label={t("common.sidebar.expand")}
              position="right"
              withArrow
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={t("common.sidebar.toggle")}
                onClick={toggleSidebar}
              >
                <PanelLeftOpen />
              </ActionIcon>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3 py-3">
            <BrandMark />
            <div className="min-w-0 flex-1">
              <Text fw={700} size="sm" truncate>
                {sidebarBrand.name}
              </Text>
              <Text c="dimmed" size="xs" truncate>
                {t(sidebarBrand.taglineKey)}
              </Text>
            </div>
            <Tooltip
              label={t("common.sidebar.collapse")}
              position="left"
              withArrow
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={t("common.sidebar.toggle")}
                onClick={toggleSidebar}
              >
                <PanelLeftClose />
              </ActionIcon>
            </Tooltip>
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1" type="hover">
          <Stack gap="md" px={compacted ? "xs" : "sm"} py="sm">
            {sidebarConfig.map((section) => (
              <Stack key={section.id} gap={4}>
                {compacted ? (
                  <div className="mx-auto h-px w-6 bg-[var(--mantine-color-default-border)]" />
                ) : (
                  <Text
                    c="dimmed"
                    fw={600}
                    size="xs"
                    tt="uppercase"
                    px="xs"
                    className="tracking-wide"
                  >
                    {t(section.labelKey)}
                  </Text>
                )}
                <Stack gap={4} align={compacted ? "center" : "stretch"}>
                  {section.items.map((item) => (
                    <SidebarEntry
                      key={item.id}
                      item={item}
                      compacted={compacted}
                      active={isSidebarItemActive(item, location.pathname)}
                    />
                  ))}
                </Stack>
              </Stack>
            ))}

            <DatabaseInstanceList compacted={compacted} />
          </Stack>
        </ScrollArea>

        <div
          className={cn(
            "flex items-center border-t border-[var(--mantine-color-default-border)]",
            compacted ? "justify-center py-3" : "px-3 py-2",
          )}
        >
          {compacted ? null : (
            <Text c="dimmed" size="xs" className="flex-1">
              v{FRONTEND_VERSION}
            </Text>
          )}
          <SettingsMenu />
        </div>
      </IconProvider>
    </Box>
  );
}
