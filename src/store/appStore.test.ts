import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SIDEBAR_COMPACTED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from "../config/sidebarLayout";
import { APP_STORE_STORAGE_KEY, useAppStore } from "./appStore";

/** Reads the snapshot `persist` wrote to `localStorage`. */
function readPersistedState(): Record<string, unknown> {
  const raw = localStorage.getItem(APP_STORE_STORAGE_KEY);
  return raw
    ? (JSON.parse(raw) as { state: Record<string, unknown> }).state
    : {};
}

describe("appStore persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().reset();
  });

  it("persists the sidebar width and nothing else", () => {
    useAppStore.getState().setSidebarWidth(SIDEBAR_COMPACTED_WIDTH);
    useAppStore.getState().incrementGreetCount();

    expect(readPersistedState()).toEqual({
      sidebarWidth: SIDEBAR_COMPACTED_WIDTH,
    });
  });

  it("keeps the demo greeting counter out of storage", () => {
    useAppStore.getState().incrementGreetCount();

    expect(readPersistedState()).not.toHaveProperty("greetCount");
  });

  it("restores the stored width on the next launch", async () => {
    localStorage.setItem(
      APP_STORE_STORAGE_KEY,
      JSON.stringify({ state: { sidebarWidth: 200 }, version: 0 }),
    );
    vi.resetModules();

    const { useAppStore: restored } = await import("./appStore");
    await restored.persist.rehydrate();

    expect(restored.getState().sidebarWidth).toBe(200);
  });

  it("falls back to the expanded width when nothing is stored", async () => {
    vi.resetModules();

    const { useAppStore: fresh } = await import("./appStore");
    await fresh.persist.rehydrate();

    expect(fresh.getState().sidebarWidth).toBe(SIDEBAR_EXPANDED_WIDTH);
  });
});
