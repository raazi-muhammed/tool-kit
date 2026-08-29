"use client"

import {
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  Copy01Icon,
  HashtagIcon,
  SquareRootSquareIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { useMemo, useState } from "react"

import type { PreviewLayer } from "@/components/preview-card"
import { PreviewCard } from "@/components/preview-card"
import { StatSection } from "@/components/stat-tile"
import { ToolPage } from "@/components/tool-page"
import { Badge } from "@/components/ui/badge"
import {
  MAX_FROM_COUNT,
  MAX_FROM_START,
  MAX_RANGE_END,
  nextPrimesFrom,
  primesInRange,
} from "@/lib/prime"

type Mode = "range" | "from"

function statValue(n: number | undefined): string {
  return n === undefined ? "—" : n.toLocaleString()
}

export default function PrimeNumbersPage() {
  const [mode, setMode] = useState<Mode>("range")
  const [rangeStart, setRangeStart] = useState("50")
  const [rangeEnd, setRangeEnd] = useState("150")
  const [fromStart, setFromStart] = useState("30")
  const [fromCount, setFromCount] = useState("20")
  const [copied, setCopied] = useState(false)

  const { primes, error } = useMemo(() => {
    if (mode === "range") {
      const start = Number(rangeStart)
      const end = Number(rangeEnd)
      if (
        rangeStart.trim() === "" ||
        rangeEnd.trim() === "" ||
        !Number.isFinite(start) ||
        !Number.isFinite(end)
      ) {
        return { primes: [] as number[], error: null }
      }
      if (start < 0) return { primes: [], error: "Start must be 0 or greater." }
      if (end > MAX_RANGE_END)
        return {
          primes: [],
          error: `End must be ${MAX_RANGE_END.toLocaleString()} or less.`,
        }
      if (end < start)
        return { primes: [], error: "End must be greater than or equal to Start." }
      return { primes: primesInRange(start, end), error: null }
    }

    const start = Number(fromStart)
    const count = Number(fromCount)
    if (
      fromStart.trim() === "" ||
      fromCount.trim() === "" ||
      !Number.isFinite(start) ||
      !Number.isFinite(count)
    ) {
      return { primes: [] as number[], error: null }
    }
    if (start < 0) return { primes: [], error: "Start must be 0 or greater." }
    if (start > MAX_FROM_START)
      return {
        primes: [],
        error: `Start must be ${MAX_FROM_START.toLocaleString()} or less.`,
      }
    if (count < 1) return { primes: [], error: "Count must be at least 1." }
    if (count > MAX_FROM_COUNT)
      return {
        primes: [],
        error: `Count must be ${MAX_FROM_COUNT.toLocaleString()} or less.`,
      }
    return { primes: nextPrimesFrom(start, Math.floor(count)), error: null }
  }, [mode, rangeStart, rangeEnd, fromStart, fromCount])

  const sum = primes.reduce((total, prime) => total + prime, 0)

  async function copyPrimes() {
    await navigator.clipboard.writeText(primes.join(", "))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const layer: PreviewLayer = error
    ? { kind: "status", message: error, tone: "destructive" }
    : primes.length > 0
      ? {
          kind: "list",
          children: (
            <div className="flex flex-wrap content-start gap-2">
              {primes.map((prime) => (
                <Badge
                  key={prime}
                  variant="outline"
                  className="px-2.5 py-1 text-sm tabular-nums"
                >
                  {prime}
                </Badge>
              ))}
            </div>
          ),
        }
      : {
          kind: "status",
          message:
            mode === "range"
              ? "No primes found in this range."
              : "No primes found.",
        }

  return (
    <ToolPage
      page="Prime Numbers"
      icon={SquareRootSquareIcon}
      segments={{
        value: mode,
        onValueChange: (value) => setMode(value as Mode),
        label: "Mode",
        options: [
          { value: "range", label: "Range", icon: ArrowLeftRightIcon },
          { value: "from", label: "From", icon: ArrowRight01Icon },
        ],
      }}
      sidebar={{
        inputs:
          mode === "range"
            ? [
                {
                  label: "Start",
                  value: rangeStart,
                  onChange: setRangeStart,
                  type: "number",
                  min: 0,
                },
                {
                  label: "End",
                  value: rangeEnd,
                  onChange: setRangeEnd,
                  type: "number",
                  min: 0,
                },
              ]
            : [
                {
                  label: "Start",
                  value: fromStart,
                  onChange: setFromStart,
                  type: "number",
                  min: 0,
                },
                {
                  label: "Count",
                  value: fromCount,
                  onChange: setFromCount,
                  type: "number",
                  min: 1,
                },
              ],
        hint: (
          <StatSection
            icon={HashtagIcon}
            label="Results"
            tiles={[
              { label: "found", value: primes.length.toLocaleString() },
              { label: "smallest", value: statValue(primes[0]) },
              { label: "largest", value: statValue(primes[primes.length - 1]) },
              { label: "sum", value: primes.length ? sum.toLocaleString() : "—" },
            ]}
          />
        ),
        actions: [
          {
            label: copied ? "Copied" : "Copy list",
            icon: copied ? Tick02Icon : Copy01Icon,
            onClick: copyPrimes,
            variant: "card",
            disabled: primes.length === 0,
          },
        ],
      }}
    >
      <PreviewCard fill layer={layer} />
    </ToolPage>
  )
}
