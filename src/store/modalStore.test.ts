import { beforeEach, describe, expect, it } from "vitest";

import { useModalStore } from "./modalStore";

describe("modalStore", () => {
  beforeEach(() => {
    useModalStore.getState().reset();
  });

  it("opens and closes a modal by id", () => {
    useModalStore.getState().openModal("language");
    expect(useModalStore.getState().openModals.language).toBe(true);

    useModalStore.getState().closeModal("language");
    expect(useModalStore.getState().openModals.language).toBe(false);
  });

  it("toggles a modal by id", () => {
    useModalStore.getState().toggleModal("language");
    expect(useModalStore.getState().openModals.language).toBe(true);

    useModalStore.getState().toggleModal("language");
    expect(useModalStore.getState().openModals.language).toBe(false);
  });

  it("closes every open modal", () => {
    useModalStore.getState().openModal("language");
    useModalStore.getState().openModal("another");

    useModalStore.getState().closeAll();

    expect(useModalStore.getState().openModals).toEqual({});
  });
});
