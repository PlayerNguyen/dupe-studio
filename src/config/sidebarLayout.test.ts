import { describe, expect, it } from "vitest";

import {
  isSidebarCompacted,
  readSidebarWidth,
  SIDEBAR_COMPACTED_MAX_WIDTH,
  SIDEBAR_COMPACTED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  snapSidebarWidth,
} from "./sidebarLayout";

describe("sidebarLayout", () => {
  it("keeps the compacted rail narrower than the expanded sidebar", () => {
    expect(SIDEBAR_COMPACTED_WIDTH).toBeLessThan(SIDEBAR_EXPANDED_WIDTH);
    expect(SIDEBAR_COMPACTED_MAX_WIDTH).toBeGreaterThan(
      SIDEBAR_COMPACTED_WIDTH,
    );
  });

  it("reads the pixel width the splitter reports", () => {
    expect(readSidebarWidth("264px")).toBe(264);
    expect(readSidebarWidth(`${SIDEBAR_COMPACTED_WIDTH}px`)).toBe(
      SIDEBAR_COMPACTED_WIDTH,
    );
  });

  it("falls back to the compacted width for an unparsable size", () => {
    expect(readSidebarWidth("auto")).toBe(SIDEBAR_COMPACTED_WIDTH);
  });

  it("treats the minimum and the threshold as compacted", () => {
    expect(isSidebarCompacted(SIDEBAR_COMPACTED_WIDTH)).toBe(true);
    expect(isSidebarCompacted(SIDEBAR_COMPACTED_MAX_WIDTH)).toBe(true);
    expect(isSidebarCompacted(SIDEBAR_COMPACTED_MAX_WIDTH + 1)).toBe(false);
    expect(isSidebarCompacted(SIDEBAR_EXPANDED_WIDTH)).toBe(false);
  });

  it("snaps a compacted release to the rail and keeps wider widths", () => {
    expect(snapSidebarWidth(90)).toBe(SIDEBAR_COMPACTED_WIDTH);
    expect(snapSidebarWidth(SIDEBAR_COMPACTED_MAX_WIDTH)).toBe(
      SIDEBAR_COMPACTED_WIDTH,
    );
    expect(snapSidebarWidth(200)).toBe(200);
    expect(snapSidebarWidth(SIDEBAR_EXPANDED_WIDTH)).toBe(
      SIDEBAR_EXPANDED_WIDTH,
    );
  });
});
