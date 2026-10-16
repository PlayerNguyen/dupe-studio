import { Modal } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useModalStore } from "../../store/modalStore";
import { type ModalId, modalRegistry } from "../registry";

/** Stable list of registered modal ids, computed once. */
const modalIds = Object.keys(modalRegistry) as ModalId[];

/**
 * Renders every open global modal into a portal.
 *
 * Reads `useModalStore` and mounts the registered component for each id whose
 * flag is `true`. Mantine's `Modal` portals to `document.body`, so modals float
 * above the shell regardless of where `ModalHost` sits in the tree. Mount
 * `<ModalHost />` once, near the app root.
 *
 * @returns The portal-rendered modals, or an empty fragment when none are open.
 */
export function ModalHost() {
  const { t } = useTranslation();
  const openModals = useModalStore((state) => state.openModals);
  const closeModal = useModalStore((state) => state.closeModal);

  return (
    <>
      {modalIds.map((id) => {
        const { titleKey, Component } = modalRegistry[id];

        return (
          <Modal
            key={id}
            opened={Boolean(openModals[id])}
            onClose={() => closeModal(id)}
            title={t(titleKey)}
            centered
            overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
          >
            {openModals[id] ? <Component /> : null}
          </Modal>
        );
      })}
    </>
  );
}
