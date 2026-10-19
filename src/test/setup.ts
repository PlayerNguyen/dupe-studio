import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import "../i18n";

/**
 * Vitest environment setup.
 *
 * Wires the `jest-dom` matchers into Vitest, unmounts React trees between tests
 * (Testing Library's automatic cleanup needs globals, which we do not enable),
 * and provides the browser APIs that Mantine touches (`matchMedia`,
 * `ResizeObserver`) but jsdom does not implement.
 *
 * Test files must also render `<MantineProvider env="test">`: jsdom reports every
 * element as a zero-sized box, so Floating UI's `hide` middleware reports the
 * reference as clipped and Mantine renders open dropdowns with `display: none`,
 * which removes them from the accessibility tree. `env="test"` is the mode
 * Mantine provides for exactly this case.
 */

afterEach(() => {
  cleanup();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/** Minimal `ResizeObserver` stub for Mantine components under jsdom. */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);
