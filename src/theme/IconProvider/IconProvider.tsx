import { useMantineColorScheme } from "@mantine/core";
import { LucideProvider } from "lucide-react";
import type { ReactNode } from "react";

/** Global size applied to every Lucide icon in the application. */
export const ICON_SIZE = 12;

/** Props for {@link IconProvider}. */
export interface IconProviderProps {
  /** Application subtree that receives the icon defaults. */
  children: ReactNode;
}

/**
 * Applies the global Lucide icon defaults.
 *
 * Rendered inside Mantine's `MantineProvider` (see `src/app/App/App.tsx`) so it
 * can read the active color scheme and tag every icon with
 * `.lucide-icon--dark` or `.lucide-icon--light` for theme-aware styling. Icons
 * inherit `currentColor`, so they keep the color of their surroundings.
 *
 * Individual icons must not pass `size`: the global {@link ICON_SIZE} is
 * authoritative. A different size is a deliberate product decision and should
 * be requested rather than hard-coded per icon.
 *
 * @param props - The subtree to apply the defaults to.
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
export function IconProvider({ children }: IconProviderProps) {
  const { colorScheme } = useMantineColorScheme();

  return (
    <LucideProvider
      size={ICON_SIZE}
      strokeWidth={2}
      className={`lucide-icon lucide-icon--${colorScheme}`}
    >
      {children}
    </LucideProvider>
  );
}
