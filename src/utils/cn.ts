import type { ClassValue } from "clsx";
import clsx from "clsx";

/**
 * Joins class name fragments into a single string.
 *
 * A thin, app-wide alias over {@link https://github.com/lukeed/clsx | clsx} so
 * conditional Tailwind classes have one consistent helper. Falsy values are
 * dropped; strings, numbers and nested arrays are flattened.
 *
 * @param values - Class name fragments accepted by `clsx`.
 * @returns The joined class name string.
 *
 * @example
 * ```ts
 * cn("p-4", isActive && "bg-brand", undefined); // "p-4 bg-brand"
 * ```
 */
export function cn(...values: ClassValue[]): string {
  return clsx(values);
}
