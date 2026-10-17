/**
 * Theme entry point.
 *
 * Re-exports the Mantine theme, its motion tokens and the CSS variables derived
 * from them so consumers import from `src/theme` instead of the implementation
 * files.
 */
export { cssVariablesResolver } from "./cssVariablesResolver";
export {
  BOUNCE_TIMING_FUNCTION,
  BRAND_PRIMARY,
  brandPalette,
  POPOVER_TRANSITION_DURATION,
  PRESS_FEEDBACK_CLASS,
  PRESS_FEEDBACK_DURATION,
  SMOOTH_TIMING_FUNCTION,
  SMOOTH_TRANSITION_DURATION,
  smoothTransition,
  TOOLTIP_TRANSITION_DURATION,
  theme,
} from "./theme";
