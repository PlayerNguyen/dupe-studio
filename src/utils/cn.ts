/**
 * Joins truthy class name fragments into a single string.
 *
 * Handy for conditionally applying Tailwind classes without a dependency.
 *
 * @param values - Class names; falsy values are dropped.
 * @returns The joined class name string.
 *
 * @example
 * ```ts
 * cn("p-4", isActive && "bg-brand", undefined); // "p-4 bg-brand"
 * ```
 */
export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}
