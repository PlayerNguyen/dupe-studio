import type { CSSVariablesResolver } from "@mantine/core";

import {
  BOUNCE_TIMING_FUNCTION,
  PRESS_FEEDBACK_DURATION,
  SMOOTH_TIMING_FUNCTION,
  SMOOTH_TRANSITION_DURATION,
} from "./theme";

/**
 * Custom CSS variables derived from the theme's motion tokens.
 *
 * `src/globals.css` consumes them (the press feedback rules and any other CSS
 * animation), so the curves and durations stay defined once in TypeScript
 * instead of being copied into the stylesheet. Exposed variables:
 *
 * - `--dupe-smooth-timing` — shared easing curve for surfaces.
 * - `--dupe-smooth-duration` — duration for modal-sized surfaces.
 * - `--dupe-bounce-timing` — overshooting curve for button release.
 * - `--dupe-press-duration` — squish duration while a button is held down.
 *
 * Pass this to `MantineProvider` (see `src/app/App/App.tsx`).
 *
 * @returns The variables Mantine injects for every color scheme. The `dark` and
 *   `light` maps are intentionally empty: the motion tokens do not change with
 *   the color scheme.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--dupe-bounce-timing": BOUNCE_TIMING_FUNCTION,
    "--dupe-press-duration": `${PRESS_FEEDBACK_DURATION}ms`,
    "--dupe-smooth-duration": `${SMOOTH_TRANSITION_DURATION}ms`,
    "--dupe-smooth-timing": SMOOTH_TIMING_FUNCTION,
  },
  dark: {},
  light: {},
});
