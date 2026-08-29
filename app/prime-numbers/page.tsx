"use client"

import {
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  Copy01Icon,
  SquareRootSquareIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

import type { PreviewLayer } from "@/components/preview-card"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { Badge } from "@/components/ui/badge"
import {
  MAX_FROM_COUNT,
  MAX_FROM_START,
  MAX_RANGE_END,
  nextPrimesFrom,
  primesInRange,
} from "@/lib/prime"
import { cn } from "@/lib/utils"

type Mode = "range" | "from"

export default function PrimeNumbersPage() {
  const [mode, setMode] = useState<Mode>("from")
  const [rangeStart, setRangeStart] = useState("50")
  const [rangeEnd, setRangeEnd] = useState("150")
  const [fromStart, setFromStart] = useState("1")
  const [fromCount, setFromCount] = useState("20")
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedPrime, setCopiedPrime] = useState<number | null>(null)

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

  async function copyPrimes() {
    await navigator.clipboard.writeText(primes.join(", "))
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 1500)
  }

  async function copyPrime(prime: number) {
    await navigator.clipboard.writeText(String(prime))
    setCopiedPrime(prime)
    setTimeout(() => {
      setCopiedPrime((current) => (current === prime ? null : current))
    }, 1000)
  }

  const layer: PreviewLayer = error
    ? { kind: "status", message: error, tone: "destructive" }
    : primes.length > 0
      ? {
          kind: "list",
          children: (
            <div className="flex flex-wrap content-start gap-2.5">
              {primes.map((prime) => (
                <Badge
                  key={prime}
                  role="button"
                  tabIndex={-1}
                  title={`Copy ${prime}`}
                  onClick={() => copyPrime(prime)}
                  className="group h-7 cursor-pointer gap-0 rounded-full bg-primary/10 px-3 text-sm text-primary tabular-nums transition-colors hover:bg-primary/15"
                >
                  {prime}
                  <span
                    className={cn(
                      "inline-flex w-0 shrink-0 items-center overflow-hidden transition-all",
                      copiedPrime === prime
                        ? "ml-1.5 w-3"
                        : "group-hover:ml-1.5 group-hover:w-3"
                    )}
                  >
                    <HugeiconsIcon
                      icon={copiedPrime === prime ? Tick02Icon : Copy01Icon}
                      aria-hidden
                      className="size-3 shrink-0"
                    />
                  </span>
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
          { value: "from", label: "From", icon: ArrowRight01Icon },
          { value: "range", label: "Range", icon: ArrowLeftRightIcon },
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
        actions: [
          {
            label: copiedAll ? "Copied" : "Copy list",
            icon: copiedAll ? Tick02Icon : Copy01Icon,
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
