import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../../../config/configureQueryClient";
import {
  SIDEBAR_COMPACTED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from "../../../config/sidebarLayout";
import { useAppStore } from "../../../store/appStore";
import { useModalStore } from "../../../store/modalStore";
import { AppSidebar } from ".";

const connectMocks = vi.hoisted(() => ({
  connectInstance: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  deleteInstance: vi.fn(),
}));

vi.mock("../../../services/database/databaseService", () => ({
  connectInstance: connectMocks.connectInstance,
}));

vi.mock("../../../services/storage/storageService", () => ({
  deleteInstance: storageMocks.deleteInstance,
}));

vi.mock("../../../services/storage/useInstances", () => ({
  useInstances: () => ({
    data: {
      items: [
        {
          id: "instance-1",
          name: "Local MySQL",
          kind: "mysql",
          is_favorite: true,
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
}));

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
    <MantineProvider env="test">
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppSidebar />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    useModalStore.getState().reset();
    connectMocks.connectInstance.mockReset();
    storageMocks.deleteInstance.mockReset();
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

  it("lists the saved database instances", () => {
    renderSidebar();

    expect(screen.getByText("Databases")).toBeInTheDocument();
    expect(screen.getByText("Local MySQL")).toBeInTheDocument();
  });

  it("connects to a saved instance when selected", async () => {
    const user = userEvent.setup();
    connectMocks.connectInstance.mockResolvedValue(undefined);
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "Local MySQL" }));

    expect(connectMocks.connectInstance).toHaveBeenCalledWith("instance-1");
  });

  it("deletes an instance from the row menu", async () => {
    const user = userEvent.setup();
    storageMocks.deleteInstance.mockResolvedValue(true);
    renderSidebar();

    await user.click(screen.getByLabelText("Instance actions"));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(storageMocks.deleteInstance).toHaveBeenCalledWith("instance-1");
  });

  it("opens the edit modal with the selected instance", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByLabelText("Instance actions"));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));

    const props = useModalStore.getState().modalProps.editInstance as {
      instance: { id: string };
    };
    expect(useModalStore.getState().openModals.editInstance).toBe(true);
    expect(props.instance.id).toBe("instance-1");
  });

  it("opens the add-instance modal from the instances action", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByLabelText("Add database"));

    expect(useModalStore.getState().openModals.addInstance).toBe(true);
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
