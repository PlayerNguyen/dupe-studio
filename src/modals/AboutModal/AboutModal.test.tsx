import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FRONTEND_VERSION } from "../../config/appInfo";
import { createQueryClient } from "../../config/configureQueryClient";
import { useModalStore } from "../../store/modalStore";
import { AboutModal } from ".";

vi.mock("../../services/system/systemService", () => ({
  getAppVersion: vi.fn(() => Promise.resolve("1.2.3")),
}));

/**
 * Renders {@link AboutModal} inside the providers it depends on.
 *
 * @returns The Testing Library render result.
 */
function renderAboutModal() {
  return render(
    <MantineProvider>
      <QueryClientProvider client={createQueryClient()}>
        <AboutModal />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("AboutModal", () => {
  beforeEach(() => {
    useModalStore.getState().reset();
    useModalStore.getState().openModal("about");
  });

  it("shows the frontend version injected at build time", () => {
    renderAboutModal();

    expect(screen.getByText(FRONTEND_VERSION)).toBeInTheDocument();
  });

  it("shows the backend version reported by the app_version command", async () => {
    renderAboutModal();

    expect(await screen.findByText("1.2.3")).toBeInTheDocument();
  });
});
