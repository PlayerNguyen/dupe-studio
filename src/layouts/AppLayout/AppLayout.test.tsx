import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { useAppStore } from "../../store/appStore";
import { AppLayout } from ".";

/**
 * Renders {@link AppLayout} with a small child route table.
 *
 * @param initialPath - Router entry used to seed the active location.
 * @returns The Testing Library render result.
 */
function renderLayout(initialPath = "/") {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <div>overview content</div> },
          { path: "settings", element: <div>settings content</div> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );

  return render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>,
  );
}

describe("AppLayout", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it("renders the sidebar beside the routed content", () => {
    renderLayout();

    expect(screen.getByText("dupe-studio")).toBeInTheDocument();
    expect(screen.getByText("overview content")).toBeInTheDocument();
  });

  it("shows the active page label in the top bar", () => {
    renderLayout("/settings");

    expect(screen.getByText("settings content")).toBeInTheDocument();
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
  });

  it("exposes a splitter separator that resizes the sidebar", () => {
    renderLayout();

    expect(screen.getByRole("separator")).toBeInTheDocument();
  });
});
