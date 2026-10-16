import { createBrowserRouter, RouterProvider } from "react-router";

import { sidebarConfig } from "../config/configureSidebar";
import { ApplicationErrorFallback } from "../error/ApplicationErrorFallback";
import { AppLayout } from "../layouts/AppLayout";
import { HomePage } from "../pages/HomePage";
import { PlaceholderPage } from "../pages/PlaceholderPage";

/**
 * Placeholder routes derived from the sidebar navigation model.
 *
 * Every non-index destination in `src/config/configureSidebar.tsx` gets a
 * working route rendered by {@link PlaceholderPage}. Replace an entry with a
 * real page as its UI is implemented.
 */
const placeholderRoutes = sidebarConfig
  .flatMap((section) => section.items)
  .filter((item) => !item.exact)
  .map((item) => ({
    path: item.path.replace(/^\//, ""),
    element: (
      <PlaceholderPage
        title={item.label}
        description={item.description}
        icon={item.icon}
      />
    ),
  }));

/**
 * Application route table.
 *
 * `AppLayout` is the persistent shell (sidebar + content) and every page
 * renders inside its `<Outlet />`. Pages live in `src/pages/<PageName>`; routes
 * fall back to {@link ApplicationErrorFallback} when they throw.
 */
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    ErrorBoundary: ApplicationErrorFallback,
    children: [{ index: true, element: <HomePage /> }, ...placeholderRoutes],
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
