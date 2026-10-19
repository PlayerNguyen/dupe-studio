import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";

import { createQueryClient } from "../../config/configureQueryClient";
import { i18n } from "../../i18n";
import { ModalHost } from "../../modals";
import { RouterComponent } from "../../router";
import { cssVariablesResolver, IconProvider, theme } from "../../theme";

/**
 * Root application component.
 *
 * Composes the cross-cutting providers in one place: Mantine (theme + color
 * scheme), Lucide icons (global size/theme), i18next (localization), TanStack
 * Query (async state) and the router. `ModalHost` renders the global modals into
 * a portal. `IconProvider` sits inside `MantineProvider` so it can read the
 * active color scheme. This mirrors the reference app's `app/app/index.tsx`,
 * minus the Redux store.
 *
 * The theme carries the motion tokens and per-component transition defaults,
 * while `cssVariablesResolver` exposes those tokens to `src/globals.css` as
 * custom properties.
 *
 * @returns The provider-wrapped application.
 */
export function App() {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="auto"
    >
      <IconProvider>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <RouterComponent />
            <ModalHost />
          </QueryClientProvider>
        </I18nextProvider>
      </IconProvider>
    </MantineProvider>
  );
}
