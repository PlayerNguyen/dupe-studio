import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import "./globals.css";

/**
 * Boots the React application into `#root`.
 *
 * Global styles and providers are wired here; application code should not import
 * this module.
 */
function bootstrap() {
  const container = document.getElementById("root");

  if (!container) {
    throw new Error("Root element #root was not found in index.html");
  }

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
