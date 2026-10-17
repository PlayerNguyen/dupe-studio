import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../i18n";

const mocks = vi.hoisted(() => ({
  storageCreateInstance: vi.fn(),
  storageListInstances: vi.fn(),
  storageQueryAudit: vi.fn(),
}));

vi.mock("../../generated/bindings", () => ({
  commands: {
    storageCreateInstance: mocks.storageCreateInstance,
    storageListInstances: mocks.storageListInstances,
    storageQueryAudit: mocks.storageQueryAudit,
  },
}));

import { createInstance, listInstances, queryAudit } from "./storageService";

describe("storageService", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    mocks.storageCreateInstance.mockReset();
    mocks.storageListInstances.mockReset();
    mocks.storageQueryAudit.mockReset();
  });

  it("returns the unwrapped page on success", async () => {
    const page = { items: [], pageInfo: { limit: 20, hasMore: false } };
    mocks.storageListInstances.mockResolvedValue({ status: "ok", data: page });

    await expect(listInstances()).resolves.toBe(page);
    expect(mocks.storageListInstances).toHaveBeenCalledWith({}, { fields: [] });
  });

  it("returns the created instance on success", async () => {
    const created = { id: "instance-1", name: "Local MySQL" };
    mocks.storageCreateInstance.mockResolvedValue({
      status: "ok",
      data: created,
    });

    const input = {
      name: "Local MySQL",
      kind: "mysql",
      host: "127.0.0.1",
      port: 3306,
      database_name: null,
      username: "root",
      secret_ref: null,
      is_favorite: false,
    };

    await expect(createInstance(input)).resolves.toBe(created);
    expect(mocks.storageCreateInstance).toHaveBeenCalledWith(input);
  });

  it("translates the save error key when create fails", async () => {
    mocks.storageCreateInstance.mockResolvedValue({
      status: "error",
      error: "errors.storage.saveFailed",
    });

    await expect(
      createInstance({
        name: "Local MySQL",
        kind: "mysql",
        host: "127.0.0.1",
        port: 3306,
        database_name: null,
        username: "root",
        secret_ref: null,
        is_favorite: false,
      }),
    ).rejects.toThrow("Could not save the database instance.");
  });

  it("translates a backend error key when listing instances fails", async () => {
    mocks.storageListInstances.mockResolvedValue({
      status: "error",
      error: "errors.storage.unknownSortField",
    });

    await expect(listInstances()).rejects.toThrow(
      "That sort field is not supported.",
    );
  });

  it("translates a backend error key when querying the audit log fails", async () => {
    mocks.storageQueryAudit.mockResolvedValue({
      status: "error",
      error: "errors.storage.invalidCursor",
    });

    await expect(queryAudit()).rejects.toThrow(
      "That page cursor is invalid or has expired.",
    );
  });

  it("forwards cursor and sort arguments to the audit command", async () => {
    mocks.storageQueryAudit.mockResolvedValue({
      status: "ok",
      data: { items: [], pageInfo: { limit: 20, hasMore: false } },
    });

    await queryAudit(
      { cursor: "abc", direction: "next", limit: 10 },
      { fields: [{ column: "occurred_at", direction: "desc" }] },
    );

    expect(mocks.storageQueryAudit).toHaveBeenCalledWith(
      { cursor: "abc", direction: "next", limit: 10 },
      { fields: [{ column: "occurred_at", direction: "desc" }] },
    );
  });
});
