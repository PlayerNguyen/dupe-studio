import type { LucideIcon } from "lucide-react";
import { Database, LayoutDashboard, Settings } from "lucide-react";

/**
 * A single destination in the primary sidebar navigation.
 *
 * Every `path` must resolve to a route declared in `src/router`; otherwise the
 * entry will highlight but navigate to the error boundary.
 */
export interface SidebarNavItem {
  /** Stable identifier, used as the React key and in `data-testid`s. */
  id: string;
  /** i18n key for the entry label (see `src/i18n/locales`). */
  labelKey: string;
  /** Router path the entry navigates to. */
  path: string;
  /** Lucide icon rendered as the entry's leading glyph. */
  icon: LucideIcon;
  /** i18n key for the short description shown in tooltips and page headers. */
  descriptionKey: string;
  /**
   * When `true`, the entry is active only on an exact path match. Useful for
   * the index route (`/`) so it does not stay highlighted on every page.
   */
  exact?: boolean;
}

/** A titled group of related {@link SidebarNavItem}s. */
export interface SidebarSection {
  /** Stable identifier, used as the React key. */
  id: string;
  /** i18n key for the section heading rendered above the items. */
  labelKey: string;
  /** Entries rendered inside the section, in display order. */
  items: SidebarNavItem[];
}

/** Product identity rendered at the top of the sidebar. */
export interface SidebarBrand {
  /** Application name (a brand, so it is not translated). */
  name: string;
  /** i18n key for the one-line tagline shown under the name. */
  taglineKey: string;
  /** Lucide icon used as the logo mark. */
  icon: LucideIcon;
}

/**
 * Brand identity for the sidebar header.
 *
 * Kept here so the shell's identity lives beside the navigation it labels.
 */
export const sidebarBrand: SidebarBrand = {
  name: "dupe-studio",
  taglineKey: "app.tagline",
  icon: Database,
};

/**
 * Ordered navigation model for the primary sidebar.
 *
 * Edit this array to add, remove or regroup destinations; the `AppSidebar`
 * component renders whatever it finds here. Labels and descriptions are i18n
 * keys resolved at render time, never literal text. Content pages are
 * intentionally left as placeholders and will be filled in later.
 */
export const sidebarConfig: SidebarSection[] = [
  {
    id: "workspace",
    labelKey: "navigation.sections.workspace",
    items: [
      {
        id: "overview",
        labelKey: "navigation.items.overview.label",
        path: "/",
        icon: LayoutDashboard,
        descriptionKey: "navigation.items.overview.description",
        exact: true,
      },
    ],
  },
  {
    id: "system",
    labelKey: "navigation.sections.system",
    items: [
      {
        id: "settings",
        labelKey: "navigation.items.settings.label",
        path: "/settings",
        icon: Settings,
        descriptionKey: "navigation.items.settings.description",
      },
    ],
  },
];

/**
 * Determines whether a navigation entry should be highlighted for a pathname.
 *
 * Exact entries match only their own path; all others also match nested paths
 * (for example `/settings/advanced` keeps the `Settings` entry active).
 *
 * @param item - The navigation entry to test.
 * @param pathname - The current router pathname (see `useLocation`).
 * @returns `true` when the entry represents the current location.
 */
export function isSidebarItemActive(
  item: SidebarNavItem,
  pathname: string,
): boolean {
  if (item.exact) {
    return pathname === item.path;
  }

  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

/**
 * Finds the navigation entry that matches the given pathname.
 *
 * Used to derive the current page's title and description in the shell.
 *
 * @param pathname - The current router pathname.
 * @returns The matching entry, or `undefined` when the path is not navigable.
 */
export function findSidebarItem(pathname: string): SidebarNavItem | undefined {
  return sidebarConfig
    .flatMap((section) => section.items)
    .find((item) => isSidebarItemActive(item, pathname));
}
