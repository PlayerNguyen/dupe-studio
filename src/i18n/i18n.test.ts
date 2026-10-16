import { beforeAll, describe, expect, it } from "vitest";

import { i18n, resources, supportedLanguages } from ".";
import { translateErrorKey, UNKNOWN_ERROR_KEY } from "./errors";

describe("i18n resources", () => {
  it("bundles a translation for every supported language", () => {
    expect(supportedLanguages).toContain("en");
    expect(supportedLanguages).toContain("vi");
    expect(resources.en.translation.app.tagline).toBeTruthy();
    expect(resources.vi.translation.app.tagline).toBeTruthy();
  });
});

describe("translateErrorKey", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates a known backend key", () => {
    expect(translateErrorKey("errors.database.connectionFailed")).toBe(
      "Could not connect to the database.",
    );
  });

  it("falls back to errors.unknown for an unknown key", () => {
    expect(translateErrorKey("errors.doesNotExist")).toBe(
      i18n.t(UNKNOWN_ERROR_KEY),
    );
  });

  it("falls back when no key is provided", () => {
    expect(translateErrorKey(null)).toBe(i18n.t(UNKNOWN_ERROR_KEY));
  });
});
