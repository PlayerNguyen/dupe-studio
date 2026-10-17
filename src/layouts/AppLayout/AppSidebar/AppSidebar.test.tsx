import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import {
  SIDEBAR_COMPACTED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from "../../../config/sidebarLayout";
import { useAppStore } from "../../../store/appStore";
import { AppSidebar } from ".";

/** Renders the current pathname so navigation can be asserted. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="pathname">{location.pathname}</span>;
}

/**
 * Renders {@link AppSidebar} inside the providers it depends on.
 *
 * @param initialPath - Router entry used to seed the active location.
 * @returns The Testing Library render result.
 */
function renderSidebar(initialPath = "/") {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppSidebar />
        <LocationProbe />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it("renders the brand and every navigation entry", () => {
    renderSidebar();

    expect(screen.getByText("dupe-studio")).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("exposes the grouped preferences behind a single settings button", () => {
    renderSidebar();

    expect(screen.getByLabelText("Open settings")).toBeInTheDocument();
  });

  it("highlights only the entry for the current path", () => {
    renderSidebar("/");

    expect(
      screen.getByText("Overview").closest('[data-active="true"]'),
    ).not.toBeNull();
    expect(
      screen.getByText("Settings").closest('[data-active="true"]'),
    ).toBeNull();
  });

  it("navigates to an entry's path when selected", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByText("Settings"));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/settings");
  });

  it("toggles between the compacted rail and the expanded width", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByLabelText("Toggle sidebar"));

    expect(useAppStore.getState().sidebarWidth).toBe(SIDEBAR_COMPACTED_WIDTH);

    await user.click(screen.getByLabelText("Toggle sidebar"));

    expect(useAppStore.getState().sidebarWidth).toBe(SIDEBAR_EXPANDED_WIDTH);
  });

  it("renders an icon rail with tooltipped labels when compacted", () => {
    useAppStore.getState().setSidebarWidth(SIDEBAR_COMPACTED_WIDTH);

    renderSidebar();

    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});
