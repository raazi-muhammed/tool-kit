"use client"

import {
  Add01Icon,
  Cancel01Icon,
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
import { useRef, useState } from "react"

import { IconTooltip } from "@/components/icon-tooltip"
import { ToolPage } from "@/components/tool-page"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Player = {
  id: number
  name: string
  score: number
}

type Orientation = "horizontal" | "vertical"

function PlayerScoreCard({
  player,
  step,
  onAdjust,
  onRemove,
}: {
  player: Player
  step: number
  onAdjust: (delta: number) => void
  onRemove: () => void
}) {
  return (
    <Card size="sm" className="h-full ring-0">
      <CardHeader>
        <CardTitle className="truncate">{player.name}</CardTitle>
        <CardAction>
          <IconTooltip label={`Remove ${player.name}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              aria-label={`Remove ${player.name}`}
            >
              <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
            </Button>
          </IconTooltip>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <span className="text-[clamp(2rem,min(12vw,16vh),12rem)] leading-none font-semibold tabular-nums">
            {player.score}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted">
          <IconTooltip label={`Subtract ${step}`}>
            <Button
              variant="ghost"
              onClick={() => onAdjust(-step)}
              aria-label={`Subtract ${step} from ${player.name}'s score`}
            >
              <HugeiconsIcon icon={MinusSignIcon} aria-hidden />
            </Button>
          </IconTooltip>
          <IconTooltip label={`Add ${step}`}>
            <Button
              variant="ghost"
              onClick={() => onAdjust(step)}
              aria-label={`Add ${step} to ${player.name}'s score`}
            >
              <HugeiconsIcon icon={PlusSignIcon} aria-hidden />
            </Button>
          </IconTooltip>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ScoreKeeperPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [newName, setNewName] = useState("")
  const [step, setStep] = useState(1)
  const [orientation, setOrientation] = useState<Orientation>("horizontal")
  const idRef = useRef(0)

  function addPlayer() {
    const name = newName.trim()
    if (!name) return
    const id = idRef.current++
    setPlayers((prev) => [...prev, { id, name, score: 0 }])
    setNewName("")
  }

  function adjustScore(id: number, delta: number) {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === id ? { ...player, score: player.score + delta } : player
      )
    )
  }

  function removePlayer(id: number) {
    setPlayers((prev) => prev.filter((player) => player.id !== id))
  }

  function resetScores() {
    setPlayers((prev) => prev.map((player) => ({ ...player, score: 0 })))
  }

  function clearAll() {
    setPlayers([])
  }

  function sortByScore() {
    setPlayers((prev) => [...prev].sort((a, b) => b.score - a.score))
  }

  const hasPlayers = players.length > 0
  const allScoresZero = players.every((player) => player.score === 0)

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
            label: "Player name",
            value: newName,
            onChange: setNewName,
            onEnter: addPlayer,
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
            label: "Add player",
            icon: Add01Icon,
            onClick: addPlayer,
            disabled: !newName.trim(),
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
            "flex flex-1 gap-4",
            orientation === "horizontal" ? "flex-row flex-wrap" : "flex-col"
          )}
        >
          {players.map((player) => (
            <div
              key={player.id}
              className={
                orientation === "horizontal" ? "min-w-60 flex-1 basis-60" : "flex-1"
              }
            >
              <PlayerScoreCard
                player={player}
                step={step}
                onAdjust={(delta) => adjustScore(player.id, delta)}
                onRemove={() => removePlayer(player.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border bg-card/40 py-16 text-center text-muted-foreground">
          <HugeiconsIcon icon={PodiumIcon} className="size-8" aria-hidden />
          <p className="text-sm">Add a player to start keeping score.</p>
        </div>
      )}
    </ToolPage>
  )
}
