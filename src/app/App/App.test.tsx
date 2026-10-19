import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useModalStore } from "../../store/modalStore";
import { App } from ".";

vi.mock("../../services/system/systemService", () => ({
  greet: vi.fn(() => Promise.resolve("hi")),
  getAppVersion: vi.fn(() => Promise.resolve("9.9.9")),
}));

vi.mock("../../services/storage/useInstances", () => ({
  useInstances: () => ({
    data: { items: [] },
    isLoading: false,
    isError: false,
  }),
}));

describe("App", () => {
  beforeEach(() => {
    useModalStore.getState().reset();
  });

  it("gives portal-rendered modal content access to the query client", async () => {
    render(<App />);

    act(() => {
      useModalStore.getState().openModal("about");
    });

    expect(await screen.findByText("9.9.9")).toBeInTheDocument();
  });
});
