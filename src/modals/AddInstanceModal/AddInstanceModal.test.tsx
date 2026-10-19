import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../../config/configureQueryClient";
import { i18n } from "../../i18n";
import { useModalStore } from "../../store/modalStore";
import { AddInstanceModal } from ".";
import { availableDatabases } from "./availableDatabases";

const mocks = vi.hoisted(() => ({
  createInstance: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock("../../services/storage/storageService", () => ({
  createInstance: mocks.createInstance,
}));

vi.mock("../../services/database/databaseService", () => ({
  testConnection: mocks.testConnection,
}));

/**
 * Renders {@link AddInstanceModal} inside the providers it depends on.
 *
 * @returns The Testing Library render result and the query client.
 */
function renderModal() {
  const queryClient = createQueryClient();
  const result = render(
    <MantineProvider env="test">
      <QueryClientProvider client={queryClient}>
        <AddInstanceModal />
      </QueryClientProvider>
    </MantineProvider>,
  );

  return { ...result, queryClient };
}

describe("AddInstanceModal", () => {
  beforeEach(async () => {
    useModalStore.getState().reset();
    useModalStore.getState().openModal("addInstance");
    mocks.createInstance.mockReset();
    mocks.testConnection.mockReset();
    await i18n.changeLanguage("en");
  });

  it("renders the engine rail and the default MySQL form", () => {
    renderModal();

    expect(screen.getByText("Available databases")).toBeInTheDocument();
    expect(screen.getByTestId("mysql-instance-form")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Instance name/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add instance" }),
    ).toBeInTheDocument();
  });

  it("validates required fields before calling the backend", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Add instance" }));

    expect(
      await screen.findByText("Enter a name for this instance."),
    ).toBeInTheDocument();
    expect(mocks.createInstance).not.toHaveBeenCalled();
  });

  it("creates the instance with the registry mapping and closes", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderModal();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    mocks.createInstance.mockResolvedValue({ id: "instance-1" });

    await user.type(
      screen.getByRole("textbox", { name: /Instance name/ }),
      "Local MySQL",
    );
    await user.type(screen.getByRole("textbox", { name: /Database/ }), "app");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Add instance" }));

    await waitFor(() => {
      expect(mocks.createInstance).toHaveBeenCalled();
    });
    expect(mocks.createInstance.mock.calls[0]?.[0]).toEqual({
      name: "Local MySQL",
      kind: "mysql",
      host: "127.0.0.1",
      port: 3306,
      database_name: "app",
      username: "root",
      secret_ref: null,
      is_favorite: false,
    });
    expect(mocks.createInstance.mock.calls[0]?.[1]).toBe("hunter2");
    expect(mocks.createInstance.mock.calls[0]?.[2]).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["storage", "instances"],
    });
    expect(useModalStore.getState().openModals.addInstance).toBe(false);
  });

  it("tests the connection with the current form values", async () => {
    const user = userEvent.setup();
    renderModal();
    mocks.testConnection.mockResolvedValue(undefined);

    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => {
      expect(mocks.testConnection).toHaveBeenCalled();
    });
    expect(mocks.testConnection.mock.calls[0]?.[0]).toEqual({
      kind: "mysql",
      host: "127.0.0.1",
      port: 3306,
      username: "root",
      password: "hunter2",
      database: null,
    });
    expect(
      await screen.findByText("Connection successful."),
    ).toBeInTheDocument();
  });

  it("shows the translated error when the connection test fails", async () => {
    const user = userEvent.setup();
    renderModal();
    mocks.testConnection.mockRejectedValue(
      new Error("Could not connect to the database."),
    );

    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(
      await screen.findByText("Could not connect to the database."),
    ).toBeInTheDocument();
  });

  it("shows a translated backend error and stays open", async () => {
    const user = userEvent.setup();
    renderModal();

    mocks.createInstance.mockRejectedValue(
      new Error("Could not save the database instance."),
    );

    await user.type(
      screen.getByRole("textbox", { name: /Instance name/ }),
      "Local MySQL",
    );
    await user.click(screen.getByRole("button", { name: "Add instance" }));

    expect(
      await screen.findByText("Could not save the database instance."),
    ).toBeInTheDocument();
    expect(useModalStore.getState().openModals.addInstance).toBe(true);
  });

  it("keeps engine defaults in the registry instead of the shell", () => {
    const [mysql] = availableDatabases;

    expect(mysql.kind).toBe("mysql");
    expect(mysql.initialValues).toMatchObject({
      instanceName: "",
      password: "",
      remember: true,
      isFavorite: false,
      host: "127.0.0.1",
      port: 3306,
      username: "root",
    });
  });
});
