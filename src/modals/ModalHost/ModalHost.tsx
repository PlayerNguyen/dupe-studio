import { type ModalId, modalRegistry } from "../registry";

/** Stable list of registered modal ids, computed once. */
const modalIds = Object.keys(modalRegistry) as ModalId[];

/**
 * Mounts every registered global modal.
 *
 * Each modal owns its Mantine `<Modal>` and decides whether it is open through
 * `useModal`, so the host has no modal chrome of its own: it simply renders the
 * registered components. Mantine portals the open modals to `document.body`, so
 * mount `<ModalHost />` once near the app root, **inside** the providers the
 * modal bodies depend on (React context flows through portals, so a modal that
 * uses TanStack Query needs `ModalHost` to be a descendant of
 * `QueryClientProvider`).
 *
 * @returns The mounted registered modals.
 */
export function ModalHost() {
  return (
    <>
      {modalIds.map((id) => {
        const Component = modalRegistry[id];

        return <Component key={id} />;
      })}
    </>
  );
}
