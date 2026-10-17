import { describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import {
  availableDatabases,
  findAvailableDatabase,
  firstAvailableDatabase,
} from "./availableDatabases";

describe("availableDatabases", () => {
  it("registers each engine once", () => {
    const kinds = availableDatabases.map((database) => database.kind);

    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toContain("mysql");
  });

  it("resolves a registered engine and rejects unsupported ones", () => {
    expect(findAvailableDatabase("mysql")).toBe(firstAvailableDatabase());
    expect(findAvailableDatabase("postgres")).toBeUndefined();
  });

  it("ships a translation for every registry label", () => {
    for (const database of availableDatabases) {
      expect(i18n.exists(database.labelKey)).toBe(true);
      expect(i18n.exists(database.descriptionKey)).toBe(true);
    }
  });

  it("keeps engine defaults in the registration", () => {
    const [mysql] = availableDatabases;

    expect(mysql.initialValues).toMatchObject({
      instanceName: "",
      isFavorite: false,
      host: "127.0.0.1",
      port: 3306,
      username: "root",
    });
  });
});
