import { MantineProvider } from "@mantine/core";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import { useModalStore } from "../../store/modalStore";
import { ModalHost } from ".";

/**
 * Renders {@link ModalHost} inside the provider it depends on.
 *
 * @returns The Testing Library render result.
 */
function renderHost() {
  return render(
    <MantineProvider>
      <ModalHost />
    </MantineProvider>,
  );
}

describe("ModalHost", () => {
  beforeEach(async () => {
    useModalStore.getState().reset();
    await i18n.changeLanguage("en");
  });

  it("renders no dialog until a modal is opened", () => {
    renderHost();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("portals the registered modal when its store flag is open", async () => {
    renderHost();

    act(() => {
      useModalStore.getState().openModal("language");
    });

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Language")).toBeInTheDocument();
  });

  it("closes the language modal after a language is selected", async () => {
    const user = userEvent.setup();
    renderHost();

    act(() => {
      useModalStore.getState().openModal("language");
    });
    await screen.findByRole("dialog");

    await user.click(screen.getByText("Tiếng Việt"));

    expect(useModalStore.getState().openModals.language).toBe(false);
    await i18n.changeLanguage("en");
  });
});
