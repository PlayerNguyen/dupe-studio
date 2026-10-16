import { describe, expect, it } from "vitest";

import {
  findSidebarItem,
  isSidebarItemActive,
  type SidebarNavItem,
  sidebarConfig,
} from "./configureSidebar";

/** Looks up a navigation entry by its stable id. */
function item(id: string): SidebarNavItem {
  const match = sidebarConfig
    .flatMap((section) => section.items)
    .find((entry) => entry.id === id);

  if (!match) {
    throw new Error(`Missing sidebar item: ${id}`);
  }

  return match;
}

describe("isSidebarItemActive", () => {
  it("matches exact entries only on their own path", () => {
    const overview = item("overview");

    expect(isSidebarItemActive(overview, "/")).toBe(true);
    expect(isSidebarItemActive(overview, "/settings")).toBe(false);
  });

  it("matches prefix entries on nested paths", () => {
    const settings = item("settings");

    expect(isSidebarItemActive(settings, "/settings")).toBe(true);
    expect(isSidebarItemActive(settings, "/settings/advanced")).toBe(true);
    expect(isSidebarItemActive(settings, "/")).toBe(false);
  });
});

describe("findSidebarItem", () => {
  it("returns the entry for the current path", () => {
    expect(findSidebarItem("/")?.id).toBe("overview");
    expect(findSidebarItem("/settings/advanced")?.id).toBe("settings");
  });

  it("returns undefined for unknown paths", () => {
    expect(findSidebarItem("/does-not-exist")).toBeUndefined();
  });
});
