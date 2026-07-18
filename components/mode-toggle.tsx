"use client"

import { useState, useSyncExternalStore } from "react"
import type { CSSProperties } from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { useAutoRunEnabled } from "@/components/auto-run-preference"
import { useCompactViewEnabled } from "@/components/compact-view-preference"
import { IconTooltip } from "@/components/icon-tooltip"
import { useAnimationsEnabled } from "@/components/motion-preference"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { cn, transformOriginFromRect } from "@/lib/utils"

const noopSubscribe = () => () => {}

type ThemeValue = "light" | "dark" | "system"

const THEME_OPTIONS: { value: ThemeValue; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

// A small "Aa" window floating over a tinted backdrop, mimicking macOS/iOS's
// own Appearance swatches — `system` shows both halves split down the middle
// instead of a single backdrop/window pair, since it doesn't have one look
// of its own.
function ThemePreview({ value }: { value: ThemeValue }) {
  if (value === "system") {
    return (
      <div className="flex size-full">
        <div className="relative flex-1 bg-neutral-700">
          <div className="absolute inset-x-1 top-4 bottom-1 flex items-center justify-center rounded-sm bg-neutral-950 text-[10px] font-medium text-neutral-50">
            Aa
          </div>
        </div>
        <div className="relative flex-1 bg-neutral-200">
          <div className="absolute inset-x-1 top-4 bottom-1 flex items-center justify-center rounded-sm bg-white text-[10px] font-medium text-neutral-900">
            Aa
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative size-full",
        value === "light" ? "bg-neutral-200" : "bg-neutral-700"
      )}
    >
      <div
        className={cn(
          "absolute inset-x-2 top-5 bottom-2 flex items-center justify-center rounded-sm text-xs font-medium",
          value === "light"
            ? "bg-white text-neutral-900"
            : "bg-neutral-950 text-neutral-50"
        )}
      >
        Aa
      </div>
    </div>
  )
}

// A mini mockup of the home-screen grid — comfortable shows a few roomy
// cards with an icon chip and title/description lines, compact packs more,
// smaller cards with just the icon chip and a title line. Built from theme
// tokens (unlike `ThemePreview`'s fixed neutrals) so it follows whichever
// theme is active.
function LayoutPreview({ compact }: { compact: boolean }) {
  return (
    <div
      className={cn(
        "grid size-full content-start bg-muted",
        compact ? "grid-cols-3 gap-1 p-1.5" : "grid-cols-2 gap-1.5 p-2"
      )}
    >
      {Array.from({ length: compact ? 9 : 4 }).map((_, i) =>
        compact ? (
          <div
            key={i}
            className="flex items-center gap-1 rounded-xs bg-background p-1"
          >
            <div className="size-1.5 shrink-0 rounded-xs bg-primary/60" />
            <div className="h-1 flex-1 rounded-full bg-foreground/20" />
          </div>
        ) : (
          <div
            key={i}
            className="flex flex-col gap-1 rounded-xs bg-background p-1.5"
          >
            <div className="size-2 rounded-xs bg-primary/60" />
            <div className="h-1 w-3/4 rounded-full bg-foreground/20" />
            <div className="h-1 w-full rounded-full bg-foreground/10" />
          </div>
        )
      )}
    </div>
  )
}

const LAYOUT_OPTIONS: { compact: boolean; label: string }[] = [
  { compact: false, label: "Comfortable" },
  { compact: true, label: "Compact" },
]

export function ModeToggle() {
  const [open, setOpen] = useState(false)
  const [transformOrigin, setTransformOrigin] = useState("")
  const { theme, setTheme } = useTheme()
  const { enabled: animationsEnabled, setEnabled: setAnimationsEnabled } =
    useAnimationsEnabled()
  const { enabled: autoRunEnabled, setEnabled: setAutoRunEnabled } =
    useAutoRunEnabled()
  const { enabled: compactViewEnabled, setEnabled: setCompactViewEnabled } =
    useCompactViewEnabled()
  // Avoids a hydration mismatch: the server always renders before
  // localStorage's theme is known, so the active swatch can only reflect
  // `theme` once mounted on the client.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
  // "system" matches `ThemeProvider`'s own `defaultTheme` (components/theme-provider.tsx).
  const activeTheme = mounted ? theme : "system"

  return (
    <>
      <IconTooltip label="Settings">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          onClick={(e) => {
            setTransformOrigin(
              transformOriginFromRect(e.currentTarget.getBoundingClientRect())
            )
            setOpen(true)
          }}
        >
          <HugeiconsIcon icon={Settings01Icon} aria-hidden />
        </Button>
      </IconTooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn("gap-4", animationsEnabled && "duration-200")}
          style={
            animationsEnabled
              ? ({
                  "--tw-enter-scale": 0.12,
                  "--tw-exit-scale": 0.12,
                  transformOrigin,
                } as CSSProperties)
              : undefined
          }
        >
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <span className="pl-1 text-xs font-medium text-muted-foreground">
              Theme
            </span>
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map(({ value, label }) => {
                const active = activeTheme === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={cn(
                        "h-16 w-full overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-popover transition-colors",
                        active ? "ring-primary" : "ring-transparent"
                      )}
                    >
                      <div className="relative size-full">
                        <ThemePreview value={value} />
                        {active && (
                          <span className="absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <HugeiconsIcon
                              icon={Tick02Icon}
                              className="size-2.5"
                              aria-hidden
                            />
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="pl-1 text-xs font-medium text-muted-foreground">
              Layout
            </span>
            <div className="grid grid-cols-2 gap-3">
              {LAYOUT_OPTIONS.map(({ compact, label }) => {
                const active = compactViewEnabled === compact
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setCompactViewEnabled(compact)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={cn(
                        "h-16 w-full overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-popover transition-colors",
                        active ? "ring-primary" : "ring-transparent"
                      )}
                    >
                      <div className="relative size-full">
                        <LayoutPreview compact={compact} />
                        {active && (
                          <span className="absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <HugeiconsIcon
                              icon={Tick02Icon}
                              className="size-2.5"
                              aria-hidden
                            />
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex h-12 items-center justify-between gap-2 rounded-lg bg-muted px-3">
            <label htmlFor="animations-toggle" className="text-sm font-medium">
              Animations
            </label>
            <Switch
              id="animations-toggle"
              checked={animationsEnabled}
              onCheckedChange={setAnimationsEnabled}
            />
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="auto-run-toggle" className="text-sm font-medium">
                Run automatically
              </label>
              <span className="text-xs text-muted-foreground">
                Skip the Scan/Convert click and apply changes as you go
              </span>
            </div>
            <Switch
              id="auto-run-toggle"
              checked={autoRunEnabled}
              onCheckedChange={setAutoRunEnabled}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
