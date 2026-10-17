import { Splitter, Text } from "@mantine/core";
import type { SplitterPaneSize } from "@mantine/hooks";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router";

import { findSidebarItem } from "../../config/configureSidebar";
import {
  readSidebarWidth,
  SIDEBAR_COMPACTED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  snapSidebarWidth,
} from "../../config/sidebarLayout";
import { useAppStore } from "../../store/appStore";
import { AppSidebar } from "./AppSidebar";

/**
 * Application shell layout.
 *
 * Composes the persistent chrome shared by every page: the primary sidebar on
 * the left (`src/layouts/AppLayout/AppSidebar`) and the routed content on the
 * right. The content area renders the router `<Outlet />` and is the only
 * scrollable region, so the sidebar and header stay fixed.
 *
 * A `Splitter` separates the two, so the sidebar can be dragged: its minimum is
 * the compacted icon rail ({@link SIDEBAR_COMPACTED_WIDTH}) and releasing inside
 * the compacted range snaps it there (see `src/config/sidebarLayout.ts`). The
 * width lives in `useAppStore`, so the rail is derived from it instead of being
 * tracked as a separate mode.
 *
 * @returns The shell wrapping the active route.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const activeItem = findSidebarItem(location.pathname);
  const sidebarWidth = useAppStore((state) => state.sidebarWidth);
  const setSidebarWidth = useAppStore((state) => state.setSidebarWidth);

  const sizes = useMemo(
    () => [`${sidebarWidth}px`, "100%"] as SplitterPaneSize[],
    [sidebarWidth],
  );

  /** Follows the drag so the rail appears as soon as the labels stop fitting. */
  const handleSizeChange = (nextSizes: SplitterPaneSize[]) => {
    setSidebarWidth(readSidebarWidth(nextSizes[0]));
  };

  /** Settles a released sidebar on the rail or on the width the user chose. */
  const handleResizeEnd = (
    _handleIndex: number,
    nextSizes: SplitterPaneSize[],
  ) => {
    setSidebarWidth(snapSidebarWidth(readSidebarWidth(nextSizes[0])));
  };

  return (
    <Splitter
      orientation="horizontal"
      withHandle={false}
      handleColor="var(--mantine-color-default-border)"
      sizes={sizes}
      onSizeChange={handleSizeChange}
      onResizeEnd={handleResizeEnd}
      className="h-screen w-screen overflow-hidden bg-[var(--mantine-color-body)] text-[var(--mantine-color-text)]"
    >
      <Splitter.Pane
        defaultSize={`${SIDEBAR_EXPANDED_WIDTH}px`}
        min={`${SIDEBAR_COMPACTED_WIDTH}px`}
      >
        <AppSidebar />
      </Splitter.Pane>

      <Splitter.Pane defaultSize="100%" min="40%">
        <div className="flex h-full min-w-0 flex-col">
          <header className="flex h-14 shrink-0 items-center border-b border-[var(--mantine-color-default-border)] px-6">
            <div className="min-w-0">
              <Text fw={600} truncate>
                {activeItem ? t(activeItem.labelKey) : "dupe-studio"}
              </Text>
              {activeItem ? (
                <Text c="dimmed" size="xs" truncate>
                  {t(activeItem.descriptionKey)}
                </Text>
              ) : null}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </Splitter.Pane>
    </Splitter>
  );
}
