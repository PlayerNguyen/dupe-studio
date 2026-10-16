import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { useAppStore } from "../../store/appStore";
import { AppSidebar } from "./AppSidebar";

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

  it("toggles the collapsed state through the store", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByLabelText("Toggle sidebar"));

    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
  });

  it("renders an icon rail with tooltipped labels when collapsed", () => {
    useAppStore.getState().setSidebarCollapsed(true);

    renderSidebar();

    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});
