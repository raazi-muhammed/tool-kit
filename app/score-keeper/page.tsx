"use client"

import {
  Add01Icon,
  Cancel01Icon,
  CrownIcon,
  DatabaseIcon,
  Delete02Icon,
  GridViewIcon,
  ListViewIcon,
  MinusSignIcon,
  PlusSignIcon,
  PodiumIcon,
  RankingIcon,
  RefreshIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState, type ReactNode } from "react"

import { IconTooltip } from "@/components/icon-tooltip"
import { useAnimationsEnabled } from "@/components/motion-preference"
import { ToolPage } from "@/components/tool-page"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { cn } from "@/lib/utils"

type Player = {
  id: number
  name: string
  score: number
  /** Sign of the most recent adjustment, so the score rolls up or down to match. */
  lastDelta: number
}

type Orientation = "horizontal" | "vertical"

// Narrowest a horizontal card gets before another row is added instead —
// comfortably wider than the round − / + buttons side by side, so the name
// and score have room to breathe.
const MIN_CARD_WIDTH = 200
const GRID_GAP = 16

/**
 * Columns for the horizontal grid: one row for up to 3 players, otherwise two
 * rows split as evenly as possible (4 -> 2+2, 8 -> 4+4, 17 -> 9+8), adding rows only
 * once cards would get narrower than `MIN_CARD_WIDTH` — so at most
 * `rows - 1` slots are ever left empty.
 */
function gridColumns(count: number, width: number): number {
  const fit =
    width > 0
      ? Math.max(
          1,
          Math.floor((width + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP))
        )
      : count
  const rows = Math.max(count <= 3 ? 1 : 2, Math.ceil(count / fit))
  return Math.ceil(count / rows)
}

/**
 * Wraps a player's score so tapping it opens a small field for adding or
 * subtracting any amount at once (e.g. a round worth 15), beyond the fixed
 * step the − / + buttons use. Enter adds.
 */
function CustomAmountPopover({
  playerName,
  onAdjust,
  className,
  children,
}: {
  playerName: string
  onAdjust: (delta: number) => void
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const parsed = Number(amount)
  const valid = amount.trim() !== "" && Number.isFinite(parsed) && parsed !== 0

  function apply(sign: -1 | 1) {
    if (!valid) return
    onAdjust(sign * parsed)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setAmount("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Add or subtract a custom amount for ${playerName}`}
          className={cn(
            "relative flex cursor-pointer items-center justify-center rounded-2xl transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
            className
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <PopoverHeader>
          <PopoverTitle>Custom amount</PopoverTitle>
        </PopoverHeader>
        <Input
          type="number"
          inputMode="decimal"
          autoFocus
          placeholder="e.g. 15"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply(1)
          }}
          aria-label="Amount"
        />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => apply(-1)}
            disabled={!valid}
          >
            <HugeiconsIcon icon={MinusSignIcon} aria-hidden />
            Subtract
          </Button>
          <Button className="flex-1" onClick={() => apply(1)} disabled={!valid}>
            <HugeiconsIcon icon={PlusSignIcon} aria-hidden />
            Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PlayerScoreCard({
  player,
  step,
  isLeader,
  compact,
  onAdjust,
}: {
  player: Player
  step: number
  isLeader: boolean
  /** Vertical layout: one single-line row instead of a tall card. */
  compact: boolean
  onAdjust: (delta: number) => void
}) {
  const { enabled: animationsEnabled } = useAnimationsEnabled()
  const direction = player.lastDelta < 0 ? -1 : 1

  const crown = (
    <HugeiconsIcon
      icon={CrownIcon}
      className="size-3.5 shrink-0 text-amber-500"
      aria-hidden
    />
  )

  const score = (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.span
        key={player.score}
        custom={direction}
        initial={
          animationsEnabled
            ? { y: `${direction * 40}%`, opacity: 0, filter: "blur(4px)" }
            : false
        }
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        exit={
          animationsEnabled
            ? { y: `${direction * -40}%`, opacity: 0, filter: "blur(4px)" }
            : { opacity: 0, transition: { duration: 0 } }
        }
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className={cn(
          "font-heading leading-none font-semibold tracking-tight tabular-nums",
          compact ? "text-5xl" : "text-[clamp(3rem,min(12vw,16vh),10rem)]"
        )}
      >
        {player.score}
      </motion.span>
    </AnimatePresence>
  )

  const adjustButton = (sign: -1 | 1, className?: string) => (
    <IconTooltip label={`${sign < 0 ? "Subtract" : "Add"} ${step}`}>
      <Button
        variant={sign < 0 ? "secondary" : "default"}
        onClick={() => onAdjust(sign * step)}
        aria-label={
          sign < 0
            ? `Subtract ${step} from ${player.name}'s score`
            : `Add ${step} to ${player.name}'s score`
        }
        className={cn(
          "shrink-0 rounded-full [&_svg:not([class*='size-'])]:size-6",
          className
        )}
      >
        <HugeiconsIcon
          icon={sign < 0 ? MinusSignIcon : PlusSignIcon}
          aria-hidden
        />
      </Button>
    </IconTooltip>
  )

  if (compact) {
    return (
      <Card className="flex-row items-center gap-4 rounded-3xl py-3 pr-3 pl-5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-3xl font-semibold tracking-tight">
            {player.name}
          </span>
          {isLeader && (
            <span className="flex" title="Leading">
              {crown}
              <span className="sr-only">Leading</span>
            </span>
          )}
        </div>
        {adjustButton(-1, "size-12")}
        <CustomAmountPopover
          playerName={player.name}
          onAdjust={onAdjust}
          className="h-14 w-24 shrink-0 overflow-hidden"
        >
          {score}
        </CustomAmountPopover>
        {adjustButton(1, "size-12")}
      </Card>
    )
  }

  return (
    <Card className="h-full gap-0 rounded-3xl py-0">
      <div className="flex items-center gap-3 p-4 pb-0">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-3xl font-semibold tracking-tight">
            {player.name}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-xs text-muted-foreground",
              !isLeader && "invisible"
            )}
          >
            {crown}
            Leading
          </span>
        </div>
      </div>

      <div className="flex min-h-32 flex-1 items-center justify-center overflow-hidden px-4">
        <CustomAmountPopover
          playerName={player.name}
          onAdjust={onAdjust}
          className="max-w-full overflow-hidden px-4 py-2"
        >
          {score}
        </CustomAmountPopover>
      </div>

      <div className="flex items-center justify-between p-4">
        {adjustButton(-1, "size-14")}
        {adjustButton(1, "size-14")}
      </div>
    </Card>
  )
}

const STORAGE_KEYS = {
  players: "score-keeper:players",
  step: "score-keeper:step",
  orientation: "score-keeper:orientation",
}

function parsePlayers(value: unknown): Player[] | null {
  if (!Array.isArray(value)) return null
  const valid = value.every(
    (p) =>
      typeof p === "object" &&
      p !== null &&
      Number.isInteger(p.id) &&
      typeof p.name === "string" &&
      Number.isFinite(p.score)
  )
  return valid
    ? value.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        lastDelta: 0,
      }))
    : null
}

function parseStep(value: unknown): number | null {
  return Number.isInteger(value) &&
    (value as number) >= 1 &&
    (value as number) <= 25
    ? (value as number)
    : null
}

function parseOrientation(value: unknown): Orientation | null {
  return value === "horizontal" || value === "vertical" ? value : null
}

type Confirmation = {
  title: string
  description: string
  actionLabel: string
  onConfirm: () => void
}

export default function ScoreKeeperPage() {
  // Players, step, and layout survive a reload via localStorage.
  const [players, setPlayers, clearStoredPlayers] = usePersistedState<Player[]>(
    STORAGE_KEYS.players,
    [],
    parsePlayers
  )
  const [step, setStep, clearStoredStep] = usePersistedState(
    STORAGE_KEYS.step,
    1,
    parseStep
  )
  const [orientation, setOrientation, clearStoredOrientation] =
    usePersistedState<Orientation>(
      STORAGE_KEYS.orientation,
      "horizontal",
      parseOrientation
    )
  const [newName, setNewName] = useState("")
  const [playersOpen, setPlayersOpen] = useState(false)
  // Measured so the horizontal grid can pick balanced rows for its width.
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null)
  const [gridWidth, setGridWidth] = useState(0)

  useEffect(() => {
    if (!gridEl) return
    const observer = new ResizeObserver(([entry]) =>
      setGridWidth(entry.contentRect.width)
    )
    observer.observe(gridEl)
    return () => observer.disconnect()
  }, [gridEl])
  // Kept after the dialog closes (only `confirmOpen` flips), so its text
  // doesn't blank out mid fade-out.
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function askToConfirm(next: Confirmation) {
    setConfirmation(next)
    setConfirmOpen(true)
  }

  function requestDeleteStorage() {
    askToConfirm({
      title: "Delete from local storage?",
      description:
        "This removes every player, score, and setting saved in this browser. This can't be undone.",
      actionLabel: "Delete",
      onConfirm: () => {
        clearStoredPlayers()
        clearStoredStep()
        clearStoredOrientation()
      },
    })
  }

  // One player per non-blank line, so a whole list can be added at once.
  const newNames = newName
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean)

  function addPlayers() {
    if (newNames.length === 0) return
    // Ids continue past the highest one in use, including restored players.
    const nextId = Math.max(-1, ...players.map((player) => player.id)) + 1
    const added = newNames.map((name, index) => ({
      id: nextId + index,
      name,
      score: 0,
      lastDelta: 0,
    }))
    setPlayers((prev) => [...prev, ...added])
    setNewName("")
  }

  function adjustScore(id: number, delta: number) {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === id
          ? { ...player, score: player.score + delta, lastDelta: delta }
          : player
      )
    )
  }

  function removePlayer(id: number) {
    setPlayers((prev) => prev.filter((player) => player.id !== id))
  }

  function resetScores() {
    setPlayers((prev) =>
      prev.map((player) => ({ ...player, score: 0, lastDelta: -1 }))
    )
  }

  function clearAll() {
    setPlayers([])
  }

  function sortByScore() {
    setPlayers((prev) => [...prev].sort((a, b) => b.score - a.score))
  }

  const hasPlayers = players.length > 0
  const allScoresZero = players.every((player) => player.score === 0)
  // Only crown a leader once someone is strictly ahead of someone else.
  const topScore = Math.max(...players.map((player) => player.score))
  const hasLeader =
    players.length > 1 && players.some((player) => player.score < topScore)

  return (
    <ToolPage
      page="Score Keeper"
      icon={PodiumIcon}
      segments={{
        value: orientation,
        onValueChange: (value) => setOrientation(value as Orientation),
        label: "Layout",
        options: [
          { value: "horizontal", label: "Horizontal", icon: GridViewIcon },
          { value: "vertical", label: "Vertical", icon: ListViewIcon },
        ],
      }}
      sidebar={{
        inputs: [
          {
            label: "Player names",
            type: "textarea",
            placeholder: "One name per line",
            value: newName,
            onChange: setNewName,
            onEnter: addPlayers,
          },
        ],
        slider: {
          label: "Step",
          value: step,
          onValueChange: setStep,
          min: 1,
          max: 25,
        },
        hint: "Add players, then use + and − to update their scores. Nothing leaves your browser.",
        actions: [
          {
            label:
              newNames.length > 1
                ? `Add ${newNames.length} players`
                : "Add player",
            icon: Add01Icon,
            onClick: addPlayers,
            disabled: newNames.length === 0,
          },
          {
            label: "Manage players",
            icon: UserMultipleIcon,
            onClick: () => setPlayersOpen(true),
            variant: "card",
            disabled: !hasPlayers,
          },
          {
            label: "Sort by score",
            icon: RankingIcon,
            onClick: sortByScore,
            variant: "card",
            disabled: players.length < 2,
          },
          {
            label: "Reset scores",
            icon: RefreshIcon,
            onClick: resetScores,
            variant: "card",
            disabled: !hasPlayers || allScoresZero,
          },
          {
            label: "Clear all",
            icon: Delete02Icon,
            onClick: clearAll,
            variant: "card",
            disabled: !hasPlayers,
          },
          {
            label: "Delete from local storage",
            icon: DatabaseIcon,
            onClick: requestDeleteStorage,
            variant: "card",
          },
        ],
      }}
    >
      {hasPlayers ? (
        <div
          ref={setGridEl}
          className={
            orientation === "horizontal"
              ? "grid flex-1 auto-rows-fr gap-4"
              : "flex flex-col gap-3"
          }
          style={
            orientation === "horizontal"
              ? {
                  gridTemplateColumns: `repeat(${gridColumns(
                    players.length,
                    gridWidth
                  )}, minmax(0, 1fr))`,
                }
              : undefined
          }
        >
          {players.map((player) => (
            <div
              key={player.id}
              className={orientation === "horizontal" ? "min-w-0" : undefined}
            >
              <PlayerScoreCard
                player={player}
                step={step}
                isLeader={hasLeader && player.score === topScore}
                compact={orientation === "vertical"}
                onAdjust={(delta) => adjustScore(player.id, delta)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md bg-card py-16 text-center text-muted-foreground">
          <HugeiconsIcon icon={PodiumIcon} className="size-8" aria-hidden />
          <p className="text-sm">Add a player to start keeping score.</p>
        </div>
      )}
      <Dialog open={playersOpen} onOpenChange={setPlayersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Players</DialogTitle>
            <DialogDescription>
              {players.length === 1 ? "1 player" : `${players.length} players`}
            </DialogDescription>
          </DialogHeader>
          {hasPlayers ? (
            <ul className="max-h-[60vh] overflow-y-auto rounded-lg bg-card">
              {players.map((player, index) => (
                <li key={player.id}>
                  {index > 0 && (
                    <div className="mx-3 h-px bg-border" aria-hidden />
                  )}
                  <div className="flex h-12 items-center gap-3 pr-1.5 pl-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {player.name}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {player.score}
                    </span>
                    <IconTooltip label={`Remove ${player.name}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePlayer(player.id)}
                        aria-label={`Remove ${player.name}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <HugeiconsIcon icon={Delete02Icon} aria-hidden />
                      </Button>
                    </IconTooltip>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No players left.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => confirmation?.onConfirm()}
            >
              <HugeiconsIcon icon={Delete02Icon} aria-hidden />
              {confirmation?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ToolPage>
  )
}
