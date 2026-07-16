import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Read the first file in a picked/dropped `FileList` as text, or `null` if empty. */
export async function readFirstFileAsText(
  files: FileList | null
): Promise<string | null> {
  const file = files?.[0]
  return file ? file.text() : null
}

/**
 * CSS `transform-origin` value for a dialog's grow-from-trigger zoom (see
 * `command-menu.tsx`'s "dramatic zoom" and the same effect on `ModeToggle`'s
 * Settings dialog and the homepage's support dialog): anchors the scale so
 * it visually grows out of the clicked trigger's center instead of the
 * dialog's own center.
 *
 * `transform-origin` resolves against the element's *untransformed* layout
 * box, not its current (possibly mid-scale-animation) box, so this has to be
 * derived analytically from the dialog's static positioning rule rather than
 * measured via `getBoundingClientRect()` at animation time. Two things about
 * that rule matter here:
 * - `anchor`: where the box's own top-left corner sits, as a fraction of the
 *   viewport (e.g. `{ x: 0.5, y: 0.5 }` for a `top-1/2 left-1/2` `DialogContent`,
 *   `{ x: 0.5, y: 1 / 3 }` for `CommandDialog`'s `top-1/3`).
 * - `translate`: the box's *own* `-translate-x/y-*` centering, as a fraction
 *   of its own size (`{ x: -0.5, y: -0.5 }` for the usual
 *   `-translate-x-1/2 -translate-y-1/2`, `{ x: -0.5, y: 0 }` for
 *   `CommandDialog`, which cancels the vertical half via `translate-y-0`).
 *   This shift moves the *origin point* right along with the rest of the
 *   box, so the offset from `anchor` alone isn't enough to land on the
 *   trigger — it has to be compensated for by pushing the origin the
 *   opposite way, by half the box's own (not-yet-known) size. Expressing
 *   that compensation as a CSS `%` (`calc(-translate*100% + Npx)`) sidesteps
 *   ever needing the box's actual pixel size, since `%` in `transform-origin`
 *   already resolves against the box's own current dimensions for us.
 */
export function transformOriginFromRect(
  rect: DOMRect,
  {
    anchor = { x: 0.5, y: 0.5 },
    translate = { x: -0.5, y: -0.5 },
  }: {
    anchor?: { x: number; y: number }
    translate?: { x: number; y: number }
  } = {}
): string {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const offsetX = centerX - window.innerWidth * anchor.x
  const offsetY = centerY - window.innerHeight * anchor.y
  const originX = `calc(${-translate.x * 100}% + ${offsetX}px)`
  const originY = `calc(${-translate.y * 100}% + ${offsetY}px)`
  return `${originX} ${originY}`
}
