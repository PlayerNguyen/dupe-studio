import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../../config/configureQueryClient";
import { i18n } from "../../i18n";
import { useModalStore } from "../../store/modalStore";
import type { DatabaseInstance } from "../../types/storage";
import { EditInstanceModal } from ".";

const mocks = vi.hoisted(() => ({
  updateInstance: vi.fn(),
}));

vi.mock("../../services/storage/storageService", () => ({
  updateInstance: mocks.updateInstance,
}));

/** A saved MySQL row used to prefill the form. */
const savedInstance: DatabaseInstance = {
  id: "instance-1",
  name: "Local MySQL",
  kind: "mysql",
  host: "127.0.0.1",
  port: 3306,
  database_name: "app",
  username: "root",
  secret_ref: "instance:instance-1",
  is_favorite: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

/**
 * Renders {@link EditInstanceModal} inside the providers it depends on.
 *
 * @returns The Testing Library render result.
 */
function renderModal() {
  return render(
    <MantineProvider>
      <QueryClientProvider client={createQueryClient()}>
        <EditInstanceModal />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("EditInstanceModal", () => {
  beforeEach(async () => {
    useModalStore.getState().reset();
    useModalStore
      .getState()
      .openModal("editInstance", { instance: savedInstance });
    mocks.updateInstance.mockReset();
    await i18n.changeLanguage("en");
  });

  it("prefills the form from the saved instance", () => {
    renderModal();

    expect(screen.getByRole("textbox", { name: /Instance name/ })).toHaveValue(
      "Local MySQL",
    );
    expect(screen.getByRole("textbox", { name: /Host/ })).toHaveValue(
      "127.0.0.1",
    );
    expect(screen.getByRole("textbox", { name: /Database/ })).toHaveValue(
      "app",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("updates the instance and closes", async () => {
    const user = userEvent.setup();
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <EditInstanceModal />
        </QueryClientProvider>
      </MantineProvider>,
    );
    mocks.updateInstance.mockResolvedValue({ id: "instance-1" });

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mocks.updateInstance).toHaveBeenCalled();
    });
    expect(mocks.updateInstance.mock.calls[0]?.[0]).toBe("instance-1");
    expect(mocks.updateInstance.mock.calls[0]?.[1]).toMatchObject({
      name: "Local MySQL",
      kind: "mysql",
      host: "127.0.0.1",
      port: 3306,
      database_name: "app",
      username: "root",
      is_favorite: false,
    });
    expect(mocks.updateInstance.mock.calls[0]?.[2]).toBeNull();
    expect(mocks.updateInstance.mock.calls[0]?.[3]).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["storage", "instances"],
    });
    expect(useModalStore.getState().openModals.editInstance).toBe(false);
  });

  it("sends a replacement password when one is typed", async () => {
    const user = userEvent.setup();
    renderModal();
    mocks.updateInstance.mockResolvedValue({ id: "instance-1" });

    await user.type(screen.getByLabelText("Password"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mocks.updateInstance).toHaveBeenCalled();
    });
    expect(mocks.updateInstance.mock.calls[0]?.[2]).toBe("new-secret");
  });
});
