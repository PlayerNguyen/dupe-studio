import { Modal } from "@mantine/core";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { useModalStore } from "../../store/modalStore";
import { type ModalId, modalRegistry } from "../registry";

/** Stable list of registered modal ids, computed once. */
const modalIds = Object.keys(modalRegistry) as ModalId[];

/**
 * Renders every open global modal into a portal.
 *
 * Reads `useModalStore` and mounts the registered component for each id whose
 * flag is `true`, forwarding the props the modal was opened with. Mantine's
 * `Modal` portals to `document.body`, so modals float above the shell
 * regardless of where `ModalHost` sits in the tree. Mount `<ModalHost />` once
 * near the app root, **inside** the providers the modal bodies depend on (React
 * context flows through portals, so a modal that uses TanStack Query needs
 * `ModalHost` to be a descendant of `QueryClientProvider`).
 *
 * @returns The portal-rendered modals, or an empty fragment when none are open.
 */
export function ModalHost() {
  const { t } = useTranslation();
  const openModals = useModalStore((state) => state.openModals);
  const modalProps = useModalStore((state) => state.modalProps);
  const closeModal = useModalStore((state) => state.closeModal);

  return (
    <>
      {modalIds.map((id) => {
        const { titleKey, Component, size } = modalRegistry[id];
        const ModalComponent = Component as unknown as ComponentType<
          Record<string, unknown>
        >;
        const props = (modalProps[id] ?? {}) as Record<string, unknown>;

        return (
          <Modal
            key={id}
            opened={Boolean(openModals[id])}
            onClose={() => closeModal(id)}
            title={t(titleKey)}
            size={size}
            centered
            overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
          >
            {openModals[id] ? <ModalComponent {...props} /> : null}
          </Modal>
        );
      })}
    </>
  );
}
