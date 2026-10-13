import { createTheme, type MantineColorsTuple } from "@mantine/core";

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
 * Application-wide Mantine theme.
 *
 * Registers the {@link brandPalette} under the `brand` key and makes it the
 * primary color. Shade `6` is used in light mode and the slightly darker shade
 * `7` in dark mode so contrast stays comfortable on both backgrounds.
 *
 * Pass this to `MantineProvider` (see `src/app/index.tsx`).
 */
export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 7 },
  colors: {
    brand: brandPalette,
  },
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});
