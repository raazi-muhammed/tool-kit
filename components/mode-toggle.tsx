"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings01Icon } from "@hugeicons/core-free-icons"

import { useAutoRunEnabled } from "@/components/auto-run-preference"
import { IconTooltip } from "@/components/icon-tooltip"
import { useAnimationsEnabled } from "@/components/motion-preference"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const noopSubscribe = () => () => {}

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { enabled: animationsEnabled, setEnabled: setAnimationsEnabled } =
    useAnimationsEnabled()
  const { enabled: autoRunEnabled, setEnabled: setAutoRunEnabled } =
    useAutoRunEnabled()
  // Avoids a hydration mismatch: the server always renders before
  // localStorage's theme is known, so the active segment can only reflect
  // `resolvedTheme` once mounted on the client.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )

  return (
    <Popover>
      <IconTooltip label="Settings">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Settings">
            <HugeiconsIcon icon={Settings01Icon} aria-hidden />
          </Button>
        </PopoverTrigger>
      </IconTooltip>
      <PopoverContent align="end" className="w-64 gap-4 p-3">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Theme
          </span>
          <Tabs
            value={mounted ? resolvedTheme : "light"}
            onValueChange={setTheme}
          >
            <TabsList className="w-full">
              <TabsTrigger value="light">Light</TabsTrigger>
              <TabsTrigger value="dark">Dark</TabsTrigger>
            </TabsList>
          </Tabs>
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
      </PopoverContent>
    </Popover>
  )
}
