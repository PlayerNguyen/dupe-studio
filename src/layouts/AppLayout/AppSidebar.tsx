import {
  ActionIcon,
  Box,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import {
  isSidebarItemActive,
  type SidebarNavItem,
  sidebarBrand,
  sidebarConfig,
} from "../../config/configureSidebar";
import { useAppStore } from "../../store/appStore";
import { cn } from "../../utils/cn";

/** Sidebar width in pixels when expanded. */
const EXPANDED_WIDTH = 264;

/** Sidebar width in pixels when collapsed to an icon rail. */
const COLLAPSED_WIDTH = 76;

/** Renders the brand logo mark shown at the top of the sidebar. */
function BrandMark() {
  const Icon = sidebarBrand.icon;

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
      <Icon size={20} />
    </span>
  );
}

/** Props for {@link SidebarEntry}. */
interface SidebarEntryProps {
  /** The navigation entry to render. */
  item: SidebarNavItem;
  /** Whether the sidebar is in its collapsed icon-rail form. */
  collapsed: boolean;
  /** Whether the entry represents the current location. */
  active: boolean;
}

/**
 * Renders a single sidebar destination in either the expanded or collapsed
 * form.
 *
 * Navigation is performed imperatively with `useNavigate` because this is a
 * desktop shell, so anchor semantics (open in new tab) are not required.
 */
function SidebarEntry({ item, collapsed, active }: SidebarEntryProps) {
  const navigate = useNavigate();
  const Icon = item.icon;
  const handleSelect = () => navigate(item.path);

  if (collapsed) {
    return (
      <Tooltip label={item.label} position="right" withArrow offset={8}>
        <UnstyledButton
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          mod={{ active }}
          onClick={handleSelect}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl text-[var(--mantine-color-dimmed)] transition-colors",
            "hover:bg-[var(--mantine-color-default-hover)] hover:text-[var(--mantine-color-text)]",
            "data-[active=true]:bg-[var(--mantine-color-brand-light)] data-[active=true]:text-[var(--mantine-color-brand-light-color)]",
          )}
        >
          <Icon size={20} />
        </UnstyledButton>
      </Tooltip>
    );
  }

  return (
    <NavLink
      active={active}
      label={item.label}
      leftSection={<Icon size={18} />}
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
 * `src/config/configureSidebar.tsx`, and a footer with the color-scheme
 * toggle. The collapsed/expanded state is owned by the Zustand store
 * (`useAppStore`) so it persists across route changes.
 *
 * @returns The rendered sidebar navigation rail.
 */
export function AppSidebar() {
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const location = useLocation();
  const navigate = useNavigate();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <Box
      component="nav"
      aria-label="Primary navigation"
      className="flex h-full shrink-0 flex-col border-r border-[var(--mantine-color-default-border)] transition-[width] duration-200 ease-out"
      style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 px-3 py-3">
          <button
            type="button"
            aria-label={sidebarBrand.name}
            onClick={() => navigate("/")}
            className="cursor-pointer border-0 bg-transparent p-0"
          >
            <BrandMark />
          </button>
          <Tooltip label="Expand sidebar" position="right" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Toggle sidebar"
              onClick={toggleSidebar}
            >
              <PanelLeftOpen size={18} />
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
              {sidebarBrand.tagline}
            </Text>
          </div>
          <Tooltip label="Collapse sidebar" position="left" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Toggle sidebar"
              onClick={toggleSidebar}
            >
              <PanelLeftClose size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1" type="hover">
        <Stack gap="md" px={collapsed ? "xs" : "sm"} py="sm">
          {sidebarConfig.map((section) => (
            <Stack key={section.id} gap={4}>
              {collapsed ? (
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
                  {section.label}
                </Text>
              )}
              <Stack gap={4} align={collapsed ? "center" : "stretch"}>
                {section.items.map((item) => (
                  <SidebarEntry
                    key={item.id}
                    item={item}
                    collapsed={collapsed}
                    active={isSidebarItemActive(item, location.pathname)}
                  />
                ))}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </ScrollArea>

      <div
        className={cn(
          "border-t border-[var(--mantine-color-default-border)]",
          collapsed
            ? "flex flex-col items-center gap-2 py-3"
            : "flex items-center justify-end px-3 py-2",
        )}
      >
        <Tooltip
          label={colorScheme === "dark" ? "Light mode" : "Dark mode"}
          position="right"
          withArrow
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Toggle color scheme"
            onClick={toggleColorScheme}
          >
            <ColorSchemeIcon dark={colorScheme === "dark"} />
          </ActionIcon>
        </Tooltip>
      </div>
    </Box>
  );
}

/** Props for {@link ColorSchemeIcon}. */
interface ColorSchemeIconProps {
  /** Whether the active scheme is dark (renders the sun to switch away). */
  dark: boolean;
}

/** Renders the sun/moon glyph for the color-scheme toggle. */
function ColorSchemeIcon({ dark }: ColorSchemeIconProps) {
  const Icon: LucideIcon = dark ? Sun : Moon;
  return <Icon size={18} />;
}
