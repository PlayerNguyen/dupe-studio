import { Text } from "@mantine/core";
import { Outlet, useLocation } from "react-router";

import { findSidebarItem } from "../../config/configureSidebar";
import { AppSidebar } from "./AppSidebar";

/**
 * Application shell layout.
 *
 * Composes the persistent chrome shared by every page: the primary sidebar on
 * the left (`src/layouts/AppLayout/AppSidebar.tsx`) and the routed content on
 * the right. The content area renders the router `<Outlet />` and is the only
 * scrollable region, so the sidebar and header stay fixed.
 *
 * @returns The shell wrapping the active route.
 */
export function AppLayout() {
  const location = useLocation();
  const activeItem = findSidebarItem(location.pathname);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--mantine-color-body)] text-[var(--mantine-color-text)]">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-[var(--mantine-color-default-border)] px-6">
          <div className="min-w-0">
            <Text fw={600} truncate>
              {activeItem?.label ?? "dupe-studio"}
            </Text>
            {activeItem?.description ? (
              <Text c="dimmed" size="xs" truncate>
                {activeItem.description}
              </Text>
            ) : null}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
