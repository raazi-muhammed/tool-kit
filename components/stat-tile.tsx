import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"

// A labeled numeric readout tile for a sidebar stats block (e.g. Word
// Counter's character/word counts, Prime Numbers' found/largest/sum) — grouped
// under `StatSection`'s heading rather than used standalone.
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted p-3">
      <span className="text-lg font-semibold text-foreground tabular-nums">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function StatSection({
  icon,
  label,
  tiles,
}: {
  icon: IconSvgElement
  label: string
  tiles: { label: string; value: string }[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-foreground">
        <HugeiconsIcon icon={icon} className="size-4" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <StatTile key={tile.label} label={tile.label} value={tile.value} />
        ))}
      </div>
    </div>
  )
}
