import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The elevation tokens, written as `shadow-[var(--shadow-card)]`.
 *
 * tailwind-merge cannot tell from `var(…)` alone whether that is a shadow or a
 * shadow *colour*, and it guessed colour. So `shadow-[var(--shadow-card)]
 * shadow-none` kept both classes and the shadow stayed, while a colour tweak —
 * `shadow-black/20` — silently deleted the elevation. The token names settle
 * it: anything in the `--shadow-` family is a shadow.
 */
const isShadowToken = (value: string) => /^\[var\(--shadow-[\w-]+\)\]$/.test(value)

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: [{ shadow: [isShadowToken] }],
    },
  },
})

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs))
}
