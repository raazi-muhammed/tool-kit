"use client"

import {
  Delete02Icon,
  LoaderPinwheelIcon,
  PlayIcon,
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
const HUB_RADIUS = 90
// Wheel segment fills cycle through these; label text is white on all of
// them, so the palette stays fixed rather than theme-derived.
const PALETTE = ["#3369e8", "#009925", "#eeb211", "#d50f25"]

// Cycle the palette, except when the count leaves the last segment the same
// color as the first (count % 4 === 1) — bump just that one so the seam
// where the wheel wraps around doesn't show two identical neighbors.
function segmentColor(index: number, count: number) {
  if (count % PALETTE.length === 1 && index === count - 1 && count > 1) {
    return PALETTE[1]
  }
  return PALETTE[index % PALETTE.length]
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
  const radius = center - 28
  const seg = TWO_PI / names.length
  ctx.clearRect(0, 0, WHEEL_SIZE, WHEEL_SIZE)

  names.forEach((_, index) => {
    const start = rotation + index * seg
    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.arc(center, center, radius, start, start + seg)
    ctx.closePath()
    ctx.fillStyle = segmentColor(index, names.length)
    ctx.fill()
  })

  // Labels sit along each segment's mid-angle, right-aligned toward the rim,
  // sized down as segments get thinner so long lists stay legible.
  const fontSize = Math.min(52, Math.max(16, seg * radius * 0.36))
  ctx.fillStyle = "#ffffff"
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  names.forEach((name, index) => {
    ctx.save()
    ctx.translate(center, center)
    ctx.rotate(rotation + (index + 0.5) * seg)
    ctx.fillText(fitLabel(ctx, name, radius - HUB_RADIUS - 70), radius - 36, 0)
    ctx.restore()
  })

  ctx.beginPath()
  ctx.arc(center, center, HUB_RADIUS, 0, TWO_PI)
  ctx.fillStyle = "#ffffff"
  ctx.fill()

  // Pointer at 3 o'clock, pointing into the wheel — drawn in the canvas so
  // it stays aligned with the wheel under object-contain scaling. The canvas
  // inherits the theme's foreground as its CSS color, so the pointer follows
  // light/dark mode.
  const pointer = getComputedStyle(canvas).color
  ctx.beginPath()
  ctx.moveTo(center + radius - 34, center)
  ctx.lineTo(center + radius + 26, center - 34)
  ctx.lineTo(center + radius + 26, center + 34)
  ctx.closePath()
  ctx.fillStyle = pointer
  ctx.fill()
}

// The segment under the pointer (angle 0, 3 o'clock) for a given rotation.
function winnerIndex(rotation: number, count: number) {
  const normalized = ((-rotation % TWO_PI) + TWO_PI) % TWO_PI
  return Math.floor(normalized / (TWO_PI / count)) % count
}

// Two bursts angled in from the bottom corners, in the wheel's own colors.
// canvas-confetti draws on its own fixed full-screen canvas at z-index 100,
// above the winner dialog's Radix overlay (z-50), so the confetti rains over
// the dialog rather than behind it.
function fireConfetti() {
  const defaults = {
    colors: PALETTE,
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
