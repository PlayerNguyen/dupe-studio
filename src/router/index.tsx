import { createBrowserRouter, RouterProvider } from "react-router";

import { ApplicationErrorFallback } from "../error/ApplicationErrorFallback";
import { HomePage } from "../pages/HomePage";

/**
 * Application route table.
 *
 * Each page lives in `src/pages/<PageName>`; add its route here. Routes fall
 * back to {@link ApplicationErrorFallback} when they throw.
 */
const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
    ErrorBoundary: ApplicationErrorFallback,
  },
]);

/**
 * Provides the configured application router to the React tree.
 *
 * @returns The router provider element.
 */
export function RouterComponent() {
  return <RouterProvider router={router} />;
}
