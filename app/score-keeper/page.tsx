"use client"

import {
  Add01Icon,
  Cancel01Icon,
  CrownIcon,
  Delete02Icon,
  GridViewIcon,
  ListViewIcon,
  MinusSignIcon,
  PlusSignIcon,
  PodiumIcon,
  RankingIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion } from "framer-motion"
import { useRef, useState } from "react"

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
import { cn } from "@/lib/utils"

type Player = {
  id: number
  name: string
  score: number
  /** Sign of the most recent adjustment, so the score rolls up or down to match. */
  lastDelta: number
}

type Orientation = "horizontal" | "vertical"

function PlayerScoreCard({
  player,
  step,
  isLeader,
  compact,
  onAdjust,
  onRemove,
}: {
  player: Player
  step: number
  isLeader: boolean
  /** Vertical layout: one single-line row instead of a tall card. */
  compact: boolean
  onAdjust: (delta: number) => void
  onRemove: () => void
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

  // Floats over the card's rounded top-right corner (outside the card's own
  // flow), so showing it on hover never shifts the name, score, or buttons.
  const removeButton = (
    <IconTooltip label={`Remove ${player.name}`}>
      <Button
        variant="secondary"
        onClick={onRemove}
        aria-label={`Remove ${player.name}`}
        className="absolute -top-2 -right-2 z-10 size-7 rounded-full p-0 ring-1 ring-border transition-opacity group-hover/player:opacity-100 focus-visible:opacity-100 md:opacity-0 [&_svg:not([class*='size-'])]:size-3.5"
      >
        <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
      </Button>
    </IconTooltip>
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
      <div className="group/player relative">
        <Card className="flex-row items-center gap-4 rounded-3xl py-3 pr-3 pl-5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-xl font-semibold tracking-tight">
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
          <div className="flex h-14 w-24 items-center justify-center overflow-hidden">
            {score}
          </div>
          {adjustButton(1, "size-12")}
        </Card>
        {removeButton}
      </div>
    )
  }

  return (
    <div className="group/player relative h-full">
      <Card className="h-full gap-0 rounded-3xl py-0">
        <div className="flex items-center gap-3 p-4 pb-0">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xl font-semibold tracking-tight">
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
          {score}
        </div>

        <div className="flex items-center justify-between p-4">
          {adjustButton(-1, "size-14")}
          {adjustButton(1, "size-14")}
        </div>
      </Card>
      {removeButton}
    </div>
  )
}

export default function ScoreKeeperPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [newName, setNewName] = useState("")
  const [step, setStep] = useState(1)
  const [orientation, setOrientation] = useState<Orientation>("horizontal")
  const idRef = useRef(0)
  // Kept after the dialog closes (only `confirmOpen` flips), so the name
  // doesn't blank out mid fade-out.
  const [removeTarget, setRemoveTarget] = useState<Player | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function requestRemove(player: Player) {
    setRemoveTarget(player)
    setConfirmOpen(true)
  }

  function confirmRemove() {
    if (removeTarget) removePlayer(removeTarget.id)
    setConfirmOpen(false)
  }

  // One player per non-blank line, so a whole list can be added at once.
  const newNames = newName
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean)

  function addPlayers() {
    if (newNames.length === 0) return
    const added = newNames.map((name) => ({
      id: idRef.current++,
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
        ],
      }}
    >
      {hasPlayers ? (
        <div
          className={cn(
            "flex",
            orientation === "horizontal"
              ? "flex-1 flex-row flex-wrap gap-4"
              : "flex-col gap-3"
          )}
        >
          {players.map((player) => (
            <div
              key={player.id}
              className={
                orientation === "horizontal"
                  ? "min-w-60 flex-1 basis-60"
                  : undefined
              }
            >
              <PlayerScoreCard
                player={player}
                step={step}
                isLeader={hasLeader && player.score === topScore}
                compact={orientation === "vertical"}
                onAdjust={(delta) => adjustScore(player.id, delta)}
                onRemove={() => requestRemove(player)}
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
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their score of {removeTarget?.score ?? 0} will be lost. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRemove}>
              <HugeiconsIcon icon={Delete02Icon} aria-hidden />
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ToolPage>
  )
}
