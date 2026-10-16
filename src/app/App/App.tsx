import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";

import { createQueryClient } from "../../config/configureQueryClient";
import { i18n } from "../../i18n";
import { ModalHost } from "../../modals";
import { RouterComponent } from "../../router";
import { theme } from "../../theme/theme";

/**
 * Root application component.
 *
 * Composes the cross-cutting providers in one place: Mantine (theme + color
 * scheme), i18next (localization), TanStack Query (async state) and the router.
 * `ModalHost` renders the global modals into a portal. This mirrors the
 * reference app's `app/app/index.tsx`, minus the Redux store.
 *
 * @returns The provider-wrapped application.
 */
export function App() {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <RouterComponent />
          <ModalHost />
        </QueryClientProvider>
      </I18nextProvider>
    </MantineProvider>
  );
}
