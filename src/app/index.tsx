import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { createQueryClient } from "../config/queryClient";
import { RouterComponent } from "../router";
import { theme } from "../theme/theme";

/**
 * Root application component.
 *
 * Composes the cross-cutting providers in one place: Mantine (theme + color
 * scheme), TanStack Query (async state) and the router. This mirrors the
 * reference app's `app/app/index.tsx`, minus the Redux store.
 *
 * @returns The provider-wrapped application.
 */
export function App() {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <QueryClientProvider client={queryClient}>
        <RouterComponent />
      </QueryClientProvider>
    </MantineProvider>
  );
}
