import { useMantineColorScheme } from "@mantine/core";
import { LucideProvider } from "lucide-react";
import type { ReactNode } from "react";

/** Global size applied to every Lucide icon in the application. */
export const ICON_SIZE = 12;

/** Props for {@link IconProvider}. */
export interface IconProviderProps {
  /** Application subtree that receives the icon defaults. */
  children: ReactNode;
  /**
   * Icon size for this subtree, in pixels.
   *
   * Defaults to {@link ICON_SIZE}; pass a value to give one region its own size
   * (the sidebar uses {@link SIDEBAR_ICON_SIZE}) without hard-coding `size` on
   * the individual icons.
   */
  size?: number;
}

/**
 * Applies the global Lucide icon defaults.
 *
 * Rendered inside Mantine's `MantineProvider` (see `src/app/App/App.tsx`) so it
 * can read the active color scheme and tag every icon with
 * `.lucide-icon--dark` or `.lucide-icon--light` for theme-aware styling. Icons
 * inherit `currentColor`, so they keep the color of their surroundings.
 *
 * Individual icons must not pass `size`: the provider is authoritative. A
 * different size is a deliberate product decision, so it is declared once as a
 * subtree default (`<IconProvider size={16}>`) rather than repeated per icon.
 *
 * @param props - The subtree and the icon size to apply to it.
 * @returns The subtree wrapped in the Lucide context provider.
 *
 * @example
 * ```tsx
 * <MantineProvider>
 *   <IconProvider>
 *     <App />
 *   </IconProvider>
 * </MantineProvider>
 * ```
 */
export function IconProvider({
  children,
  size = ICON_SIZE,
}: IconProviderProps) {
  const { colorScheme } = useMantineColorScheme();

  return (
    <LucideProvider
      size={size}
      strokeWidth={2}
      className={`lucide-icon lucide-icon--${colorScheme}`}
    >
      {children}
    </LucideProvider>
  );
}
