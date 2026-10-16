import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../../config/configureQueryClient";
import { useAppStore } from "../../store/appStore";
import { HomePage } from ".";

vi.mock("../../services/system/systemService", () => ({
  greet: vi.fn(({ name }: { name: string }) =>
    Promise.resolve(`Hello, ${name}!`),
  ),
}));

/**
 * Renders {@link HomePage} wrapped in the providers it depends on.
 *
 * @returns The Testing Library render result.
 */
function renderHomePage() {
  return render(
    <MantineProvider>
      <QueryClientProvider client={createQueryClient()}>
        <HomePage />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it("renders the brand heading and the initial greet count", () => {
    renderHomePage();

    expect(
      screen.getByRole("heading", { name: "dupe-studio" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("greet-count")).toHaveTextContent("0");
  });

  it("greets the entered name and increments the count", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.click(screen.getByRole("button", { name: "Greet" }));

    expect(await screen.findByTestId("greet-result")).toHaveTextContent(
      "Hello, Ada!",
    );
    expect(screen.getByTestId("greet-count")).toHaveTextContent("1");
  });

  it("keeps the greet button disabled until a name is entered", () => {
    renderHomePage();

    expect(screen.getByRole("button", { name: "Greet" })).toBeDisabled();
  });
});
