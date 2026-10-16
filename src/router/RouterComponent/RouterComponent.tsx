import { RouterProvider } from "react-router";

import { appRouter } from "../routes";

/**
 * Provides the configured application router to the React tree.
 *
 * Thin provider around the {@link appRouter} route table; keep route
 * definitions in `src/router/routes.tsx`.
 *
 * @returns The router provider element.
 */
export function RouterComponent() {
  return <RouterProvider router={appRouter} />;
}
