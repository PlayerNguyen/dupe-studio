import {
  createTheme,
  type MantineColorsTuple,
  type TransitionOverride,
} from "@mantine/core";

/**
 * Canonical dupe-studio brand color.
 *
 * Used as the Mantine primary (shade 6 in light mode) and mirrored in
 * `src/globals.css` as Tailwind's `brand` color scale so both styling systems
 * stay in sync.
 */
export const BRAND_PRIMARY = "#114573";

/**
 * Ten-shade brand palette consumed by Mantine.
 *
 * Index `0` is the lightest tint and index `9` the darkest shade. Mantine
 * requires exactly ten entries; `primaryShade` decides which index is used as
 * the interactive color per color scheme.
 */
export const brandPalette: MantineColorsTuple = [
  "#eff5fb",
  "#d7e6f4",
  "#b8d3ea",
  "#90bae0",
  "#5c9dd6",
  "#2578c1",
  "#114573",
  "#0d385e",
  "#092b49",
  "#062037",
];

/**
 * Easing curve shared by every animated surface.
 *
 * The "sheet" curve: motion starts quickly and eases out with almost no
 * overshoot, which reads as smooth instead of snappy. Also exposed to
 * components and CSS through `theme.other.smoothTiming`.
 */
export const SMOOTH_TIMING_FUNCTION = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Enter/exit duration, in milliseconds, for modal-sized surfaces (modals and
 * drawers).
 *
 * The longest duration: these surfaces travel the largest distance and cover
 * the most screen area, so a shorter animation looks abrupt.
 */
export const SMOOTH_TRANSITION_DURATION = 420;

/**
 * Duration, in milliseconds, for floating surfaces anchored to a target (menus
 * and popovers).
 *
 * Shorter than {@link SMOOTH_TRANSITION_DURATION} because the surface only
 * travels the distance to its trigger; reusing the modal timing here feels
 * sluggish.
 */
export const POPOVER_TRANSITION_DURATION = 315;

/**
 * Duration, in milliseconds, for tooltips.
 *
 * The shortest of the three: a tooltip is a transient hint and must never make
 * the user wait for it.
 */
export const TOOLTIP_TRANSITION_DURATION = 252;

/**
 * Easing curve for the release half of a button press.
 *
 * Unlike {@link SMOOTH_TIMING_FUNCTION}, this curve overshoots slightly (its
 * second control point sits above `1`), so a button springs back instead of
 * simply returning: a small, smooth bounce rather than a snap.
 */
export const BOUNCE_TIMING_FUNCTION = "cubic-bezier(0.22, 1.4, 0.36, 1)";

/**
 * Duration, in milliseconds, of the squish while a button is held down.
 *
 * Much shorter than the release: the press must feel immediate, the spring back
 * is what carries the character.
 */
export const PRESS_FEEDBACK_DURATION = 110;

/**
 * Class that gives a pressable element the squish-and-spring feedback.
 *
 * The rules live in `src/globals.css` because they need the `:active`
 * pseudo-class; this constant is the only place the name is spelled in
 * TypeScript, and `theme.test.tsx` pins it to the name the stylesheet uses.
 */
export const PRESS_FEEDBACK_CLASS = "dupe-press-feedback";

/**
 * Builds `transitionProps` for a component that follows the shared motion
 * tokens.
 *
 * Keeps the curve in one place: components configured through the theme and
 * components configured inline animate identically.
 *
 * @param overrides - Transition fields specific to the surface, for example its
 *   `transition` name or a shorter `duration`. Defaults to
 *   {@link SMOOTH_TRANSITION_DURATION} and {@link SMOOTH_TIMING_FUNCTION}.
 * @returns The `transitionProps` object to hand to a Mantine component.
 *
 * @example
 * ```ts
 * smoothTransition({ transition: "fade-down" });
 * // { duration: 420, timingFunction: "cubic-bezier(0.32, 0.72, 0, 1)", transition: "fade-down" }
 * ```
 */
export function smoothTransition(
  overrides: TransitionOverride = {},
): TransitionOverride {
  return {
    duration: SMOOTH_TRANSITION_DURATION,
    timingFunction: SMOOTH_TIMING_FUNCTION,
    ...overrides,
  };
}

/**
 * Application-wide Mantine theme.
 *
 * Registers the {@link brandPalette} under the `brand` key and makes it the
 * primary color. Shade `6` is used in light mode and the slightly darker shade
 * `7` in dark mode so contrast stays comfortable on both backgrounds.
 *
 * Motion is configured in three places: the tokens in `theme.other` (for code
 * that needs the raw values, including CSS), the per-component
 * `transitionProps` defaults below, which apply {@link smoothTransition} to the
 * surfaces the app animates, and {@link PRESS_FEEDBACK_CLASS}, which buttons
 * get as a class so a press squishes and springs back. Mantine 9 has no global
 * transition timing option, so a component that is not listed here keeps
 * Mantine's own default; give it `transitionProps={smoothTransition(...)}` at
 * the call site instead.
 *
 * Pass this to `MantineProvider` (see `src/app/App/App.tsx`); the CSS custom
 * properties the stylesheet reads come from `src/theme/cssVariablesResolver.ts`.
 */
export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 7 },
  colors: {
    brand: brandPalette,
  },
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  other: {
    smoothTiming: SMOOTH_TIMING_FUNCTION,
    transitionDuration: SMOOTH_TRANSITION_DURATION,
  },
  components: {
    ActionIcon: {
      classNames: { root: PRESS_FEEDBACK_CLASS },
    },
    Button: {
      classNames: { root: PRESS_FEEDBACK_CLASS },
    },
    Drawer: {
      defaultProps: {
        // No `transition`: Mantine derives the slide direction from the
        // drawer's `position`, and the override keeps that direction.
        transitionProps: smoothTransition(),
      },
    },
    Menu: {
      defaultProps: {
        transitionProps: smoothTransition({
          transition: "pop-top-right",
          duration: POPOVER_TRANSITION_DURATION,
        }),
      },
    },
    Modal: {
      defaultProps: {
        transitionProps: smoothTransition({ transition: "fade-down" }),
      },
    },
    Tooltip: {
      defaultProps: {
        transitionProps: smoothTransition({
          transition: "fade",
          duration: TOOLTIP_TRANSITION_DURATION,
        }),
      },
    },
  },
});

/**
 * Additional theme fields exposed through `theme.other`.
 *
 * Mantine types `theme.other` as `Record<string, any>`; merging this interface
 * keeps `theme.other.smoothTiming` and `theme.other.transitionDuration` typed
 * for consumers.
 */
declare module "@mantine/core" {
  interface MantineThemeOther {
    /** Easing curve shared by every animated surface. */
    smoothTiming: string;
    /** Enter/exit duration, in milliseconds, for modal-sized surfaces. */
    transitionDuration: number;
  }
}
