"use client"

import {
  Delete02Icon,
  LoaderPinwheelIcon,
  PlayIcon,
  RefreshIcon,
  ShuffleIcon,
  SortingAZ01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import confetti from "canvas-confetti"
import { useEffect, useMemo, useRef, useState } from "react"

import { useAnimationsEnabled } from "@/components/motion-preference"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const TWO_PI = Math.PI * 2
// Backing-store size — the canvas scales to its box via object-contain.
const WHEEL_SIZE = 1000
// The pointer is a notch cut into the top of the ring (12 o'clock) rather
// than an arrow at the side — `winnerIndex` reads the segment under this
// same fixed angle.
const POINTER_ANGLE = -Math.PI / 2
// The wheel itself is neutral/monochrome now, but the win confetti still
// gets to be colorful — these never touch a wheel segment.
const CONFETTI_COLORS = ["#3369e8", "#009925", "#eeb211", "#d50f25"]

// The hub's "spin" glyph is stroked straight onto the canvas via Path2D — the
// React <HugeiconsIcon> wrapper used everywhere else in the app needs a real
// DOM, not a canvas — so it's the actual RefreshIcon's path data (24x24
// viewBox) pulled from the icon library itself, not a hand-copied string,
// so it can't drift from the icon if hugeicons ever changes this glyph.
const REFRESH_ICON_PATH = String(RefreshIcon[0][1].d)

// Segments alternate two shades by index parity — except an odd count can
// never alternate cleanly all the way around (index 0 and the wrap-around
// last index are both "even", landing on the same shade and merging into
// one oversized band). Two shades can't fix that for every odd count: the
// last index's neighbors are always index 0 (shade A) and the second-to-
// last index (always shade B, since it's odd whenever the count is odd),
// so giving the last index a third shade — distinct from both — guarantees
// it can never clash with either neighbor, no matter the count.
function segmentTint(index: number, count: number) {
  if (count % 2 === 1 && index === count - 1) return 9
  return index % 2 === 0 ? 3 : 6
}

function fitLabel(ctx: CanvasRenderingContext2D, name: string, max: number) {
  if (ctx.measureText(name).width <= max) return name
  let label = name
  while (label.length > 1 && ctx.measureText(`${label}…`).width > max) {
    label = label.slice(0, -1)
  }
  return `${label}…`
}

function drawWheel(
  canvas: HTMLCanvasElement,
  names: string[],
  rotation: number
) {
  const ctx = canvas.getContext("2d")
  if (!ctx || names.length === 0) return
  const center = WHEEL_SIZE / 2
  const outerRadius = center - 20
  const ringWidth = outerRadius * 0.115
  const segmentRadius = outerRadius - ringWidth
  const hubRadius = segmentRadius * 0.42
  const seg = TWO_PI / names.length
  // The wheel's grays are low-opacity overlays of the canvas's own computed
  // foreground color (the same trick the old pointer used to stay theme
  // aware) — the identical tint reads as a light gray over a dark card and
  // a dark gray over a light one, so there's no separate light/dark palette
  // to maintain. color-mix (not manual rgba parsing) keeps this robust
  // regardless of what color space getComputedStyle happens to resolve to.
  const fg = getComputedStyle(canvas).color
  const tint = (percent: number) =>
    `color-mix(in srgb, ${fg} ${percent}%, transparent)`
  ctx.clearRect(0, 0, WHEEL_SIZE, WHEEL_SIZE)

  // Outer ring, filled first so the segments — drawn at a slightly smaller
  // radius below — leave its rim exposed as a border.
  ctx.beginPath()
  ctx.arc(center, center, outerRadius, 0, TWO_PI)
  ctx.fillStyle = tint(10)
  ctx.fill()

  // Each segment is an annular wedge (outer arc at segmentRadius, inner arc
  // at hubRadius traced backwards), not a full pie slice reaching the
  // center — that leaves the hub an untouched hole showing the card behind
  // it, rather than needing to know the card's actual color to fill it.
  names.forEach((_, index) => {
    const start = rotation + index * seg
    ctx.beginPath()
    ctx.arc(center, center, segmentRadius, start, start + seg)
    ctx.arc(center, center, hubRadius, start + seg, start, true)
    ctx.closePath()
    ctx.fillStyle = tint(segmentTint(index, names.length))
    ctx.fill()
  })

  // Pointer notch: a triangular bite erased out of the ring's top, apex
  // pointing down into the wheel.
  ctx.save()
  ctx.globalCompositeOperation = "destination-out"
  const baseHalfWidth = outerRadius * 0.075
  const noseY = center - outerRadius + ringWidth * 1.8
  ctx.beginPath()
  ctx.moveTo(center - baseHalfWidth, center - outerRadius - 20)
  ctx.lineTo(center + baseHalfWidth, center - outerRadius - 20)
  ctx.lineTo(center, noseY)
  ctx.closePath()
  ctx.fillStyle = "#000"
  ctx.fill()
  ctx.restore()

  // Labels stay upright (never rotated) as the wheel spins — only their
  // position moves — sized down and truncated as segments get thinner so
  // long lists stay legible.
  const midRadius = hubRadius + (segmentRadius - hubRadius) * 0.6
  const maxLabelWidth = 2 * midRadius * Math.sin(seg / 2) * 0.82
  const fontSize = Math.min(40, Math.max(14, seg * segmentRadius * 0.24))
  ctx.fillStyle = fg
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  names.forEach((name, index) => {
    const angle = rotation + (index + 0.5) * seg
    const x = center + Math.cos(angle) * midRadius
    const y = center + Math.sin(angle) * midRadius
    ctx.fillText(fitLabel(ctx, name, maxLabelWidth), x, y)
  })

  // Hub: left as an untouched hole so it reads as the same surface behind
  // the wheel, with just a thin ring to separate it from the segments.
  ctx.beginPath()
  ctx.arc(center, center, hubRadius, 0, TWO_PI)
  ctx.lineWidth = outerRadius * 0.01
  ctx.strokeStyle = tint(12)
  ctx.stroke()

  const iconSize = hubRadius * 0.5
  const iconScale = iconSize / 24
  const iconCenterY = center - hubRadius * 0.24
  ctx.save()
  ctx.translate(center - iconSize / 2, iconCenterY - iconSize / 2)
  ctx.scale(iconScale, iconScale)
  ctx.lineWidth = 1.5
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.strokeStyle = fg
  ctx.stroke(new Path2D(REFRESH_ICON_PATH))
  ctx.restore()

  ctx.fillStyle = fg
  ctx.font = `700 ${Math.round(hubRadius * 0.32)}px system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("Spin", center, center + hubRadius * 0.32)
}

// The segment under the fixed pointer angle for a given rotation.
function winnerIndex(rotation: number, count: number) {
  const seg = TWO_PI / count
  const normalized = (((POINTER_ANGLE - rotation) % TWO_PI) + TWO_PI) % TWO_PI
  return Math.floor(normalized / seg) % count
}

// Two bursts angled in from the bottom corners. canvas-confetti draws on
// its own fixed full-screen canvas at z-index 100, above the winner
// dialog's Radix overlay (z-50), so the confetti rains over the dialog
// rather than behind it.
function fireConfetti() {
  const defaults = {
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
    spread: 70,
    startVelocity: 55,
    ticks: 250,
  }
  confetti({
    ...defaults,
    particleCount: 90,
    angle: 60,
    origin: { x: 0.1, y: 0.9 },
  })
  confetti({
    ...defaults,
    particleCount: 90,
    angle: 120,
    origin: { x: 0.9, y: 0.9 },
  })
}

export default function WheelSpinPage() {
  const [text, setText] = useState("")
  const [spinSeconds, setSpinSeconds] = useState(5)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [winnerOpen, setWinnerOpen] = useState(false)
  const { enabled: animationsEnabled } = useAnimationsEnabled()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)
  const rafRef = useRef(0)

  const names = useMemo(
    () =>
      text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [text]
  )
  // The animation loop reads names through a ref so an edit mid-spin redraws
  // (and settles on) the live list instead of the one captured at spin time.
  const namesRef = useRef(names)

  useEffect(() => {
    namesRef.current = names
    const canvas = canvasRef.current
    if (canvas) drawWheel(canvas, names, rotationRef.current)
  }, [names])

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      // Drop canvas-confetti's full-screen canvas so a burst doesn't outlive
      // the page on navigation.
      confetti.reset()
    },
    []
  )

  function settle() {
    const current = namesRef.current
    if (current.length === 0) return
    setWinner(current[winnerIndex(rotationRef.current, current.length)])
    setWinnerOpen(true)
    if (animationsEnabled) fireConfetti()
  }

  function spin() {
    if (spinning || names.length < 2) return
    setWinner(null)
    const from = rotationRef.current
    const target = from + TWO_PI * (5 + Math.random() * 5)

    if (!animationsEnabled) {
      rotationRef.current = target % TWO_PI
      const canvas = canvasRef.current
      if (canvas) drawWheel(canvas, namesRef.current, rotationRef.current)
      settle()
      return
    }

    setSpinning(true)
    const duration = spinSeconds * 1000
    let startTime: number | null = null
    const step = (now: number) => {
      startTime ??= now
      const progress = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      rotationRef.current = (from + (target - from) * eased) % TWO_PI
      const canvas = canvasRef.current
      if (canvas) drawWheel(canvas, namesRef.current, rotationRef.current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setSpinning(false)
        settle()
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  // A stale winner from the previous list would mislead once the entries
  // change, so edits clear it.
  function changeText(value: string) {
    setText(value)
    setWinner(null)
  }

  function shuffleNames() {
    const shuffled = [...names]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    changeText(shuffled.join("\n"))
  }

  function sortNames() {
    changeText(
      [...names]
        .sort((a, b) =>
          a.localeCompare(b, undefined, {
            sensitivity: "base",
          })
        )
        .join("\n")
    )
  }

  function removeWinner() {
    if (winner === null) return
    setWinnerOpen(false)
    const index = names.indexOf(winner)
    if (index === -1) return
    changeText(names.filter((_, i) => i !== index).join("\n"))
  }

  return (
    <ToolPage
      page="Wheel Spin"
      icon={LoaderPinwheelIcon}
      sidebar={{
        slider: {
          label: "Spin time",
          value: spinSeconds,
          onValueChange: setSpinSeconds,
          min: 1,
          max: 15,
          disabled: spinning,
          unit: "s",
        },
        hint: winner ? (
          <span>
            Winner:{" "}
            <span className="font-semibold text-foreground">{winner}</span>
          </span>
        ) : (
          "Add one name per line, then hit Spin — clicking the wheel spins it too. Nothing leaves your browser."
        ),
        actions: [
          {
            label: "Shuffle",
            icon: ShuffleIcon,
            onClick: shuffleNames,
            disabled: spinning || names.length < 2,
            variant: "secondary",
          },
          {
            label: "Sort",
            icon: SortingAZ01Icon,
            onClick: sortNames,
            disabled: spinning || names.length < 2,
            variant: "secondary",
          },
          winner !== null && {
            label: "Remove winner",
            icon: Delete02Icon,
            onClick: removeWinner,
            variant: "secondary",
          },
          {
            label: "Spin",
            icon: PlayIcon,
            onClick: spin,
            disabled: spinning || names.length < 2,
          },
        ],
      }}
    >
      {/* PreviewCard's shared height cap (100dvh-220px) budgets for a
          header-action row and a bottom bar, neither of which this page has,
          so the default cap leaves ~80px of dead card below the viewport —
          visible as the entries textarea's focus ring stopping short of the
          card's bottom edge. Raise the cap to this page's actual chrome:
          p-6 top+bottom (48) + breadcrumb (32) + one gap-4 (16) + pane
          title and its gap (28) + the Card's own p-2 (16) = 140. */}
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-[3fr_2fr]">
        <PreviewCard
          fill
          half
          className="max-h-[calc(100dvh-140px)]"
          title="Wheel"
          layer={
            names.length > 0
              ? {
                  ref: canvasRef,
                  width: WHEEL_SIZE,
                  height: WHEEL_SIZE,
                  onClick: spin,
                  className: "h-full w-full cursor-pointer object-contain",
                  role: "button",
                  "aria-label": "Spin the wheel",
                }
              : {
                  kind: "status",
                  icon: LoaderPinwheelIcon,
                  message: "Add at least two names to build the wheel.",
                }
          }
        />
        <PreviewCard
          fill
          half
          className="max-h-[calc(100dvh-140px)]"
          title={`Entries${names.length > 0 ? ` (${names.length})` : ""}`}
          layer={{
            kind: "textinput",
            value: text,
            onChange: changeText,
            placeholder: "One name per line (your list is not saved anywhere)",
          }}
        />
      </div>

      <Dialog open={winnerOpen} onOpenChange={setWinnerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>We have a winner!</DialogTitle>
            <DialogDescription>
              Picked at random from {names.length} entries.
            </DialogDescription>
          </DialogHeader>
          <p className="py-4 text-center text-4xl font-semibold break-words">
            {winner}
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={removeWinner}>
              <HugeiconsIcon icon={Delete02Icon} aria-hidden />
              Remove winner
            </Button>
            <Button
              onClick={() => {
                setWinnerOpen(false)
                spin()
              }}
            >
              <HugeiconsIcon icon={PlayIcon} aria-hidden />
              Spin again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ToolPage>
  )
}
