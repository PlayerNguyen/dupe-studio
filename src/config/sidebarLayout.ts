/**
 * Layout metrics for the resizable primary sidebar.
 *
 * The sidebar is a `Splitter` pane (`src/layouts/AppLayout/AppLayout.tsx`), so
 * its width is the single source of truth: the compacted icon rail is the pane
 * at its minimum width rather than a separate mode that has to be kept in sync.
 */

/** Sidebar width in pixels when the navigation labels are visible. */
export const SIDEBAR_EXPANDED_WIDTH = 264;

/** Sidebar width in pixels at its minimum: the compacted icon rail. */
export const SIDEBAR_COMPACTED_WIDTH = 76;

/**
 * Width in pixels below which the sidebar renders the compacted icon rail.
 *
 * The labels no longer fit below this width, so the sidebar switches to the rail
 * and, on release, snaps to {@link SIDEBAR_COMPACTED_WIDTH}.
 */
export const SIDEBAR_COMPACTED_MAX_WIDTH = 140;

/**
 * Reads a sidebar pane size reported by the splitter.
 *
 * Pane sizes keep the unit they were declared in and the sidebar pane is
 * declared in pixels, so the numeric part is the width in pixels.
 *
 * @param size - Size reported by `Splitter`, for example `"264px"`.
 * @returns The width in pixels, or {@link SIDEBAR_COMPACTED_WIDTH} when the
 *   value cannot be parsed.
 */
export function readSidebarWidth(size: number | string): number {
  const width = Number.parseFloat(String(size));
  return Number.isFinite(width) ? width : SIDEBAR_COMPACTED_WIDTH;
}

/**
 * Whether a sidebar width should render the compacted icon rail.
 *
 * @param width - Current sidebar width in pixels.
 * @returns `true` when the navigation labels no longer fit.
 */
export function isSidebarCompacted(width: number): boolean {
  return width <= SIDEBAR_COMPACTED_MAX_WIDTH;
}

/**
 * Settles a width the user released the splitter at.
 *
 * Dragging into the compacted range snaps to the rail's exact width, so the
 * icon rail is never rendered at an arbitrary in-between size. Wider widths are
 * kept as-is: they are a deliberate choice, not an accident.
 *
 * @param width - Width the splitter was released at, in pixels.
 * @returns {@link SIDEBAR_COMPACTED_WIDTH} when compacted, otherwise `width`.
 */
export function snapSidebarWidth(width: number): number {
  return isSidebarCompacted(width) ? SIDEBAR_COMPACTED_WIDTH : width;
}
