"use client"

import { useState, useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { useAutoRunEnabled } from "@/components/auto-run-preference"
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
import { cn } from "@/lib/utils"

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

export function ModeToggle() {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { enabled: animationsEnabled, setEnabled: setAnimationsEnabled } =
    useAnimationsEnabled()
  const { enabled: autoRunEnabled, setEnabled: setAutoRunEnabled } =
    useAutoRunEnabled()
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
          onClick={() => setOpen(true)}
        >
          <HugeiconsIcon icon={Settings01Icon} aria-hidden />
        </Button>
      </IconTooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
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
